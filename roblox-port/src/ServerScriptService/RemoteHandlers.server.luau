--!strict
-- EXOTIC server remotes — replaces the Next.js API routes. Every handler
-- mirrors the corresponding route's contract so the client code ports verbatim.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Remotes = require(Shared:WaitForChild("Remotes"))
local Catalog = require(Shared:WaitForChild("Catalog"))
local DataService = require(script.Parent:WaitForChild("DataService"))
local LeaderboardService = require(script.Parent:WaitForChild("LeaderboardService"))
local AchievementService = require(script.Parent:WaitForChild("AchievementService"))

local ITEM_MAP = {}
for _, item in ipairs(Catalog.SHOP_ITEMS) do ITEM_MAP[item.id] = item end

local LEVEL_COUNT = #Catalog.LEVEL_META
local function parFor(levelId)
	local meta = Catalog.LEVEL_META[levelId]
	return meta and meta.par or nil
end
local function deathlessBonusFor(levelId)
	local meta = Catalog.LEVEL_META[levelId]
	return meta and meta.deathlessBonus or 0
end

-- Mirrors providers.tsx: unlockedLevel = min(levelCount, max(1, maxCompleted + 1 + unlockBoost))
local function unlockedFor(progress, profile)
	local maxCompleted = 0
	for id, p in pairs(progress or {}) do
		if p and p.completed then
			local n = tonumber(id) or 0
			if n > maxCompleted then maxCompleted = n end
		end
	end
	local boost = (profile and profile.unlockBoost) or 0
	return math.clamp(maxCompleted + 1 + boost, 1, LEVEL_COUNT)
end

-- ——— FetchState ———
Remotes.FetchState.OnServerInvoke = function(player)
	local session = DataService.ensure(player)
	return {
		account = { id = tostring(player.UserId), username = player.Name, isGuest = false },
		profile = session.profile,
		settings = session.settings,
		progress = session.progress,
		owned = session.purchases,
		unlockedLevel = unlockedFor(session.progress, session.profile),
		achievements = AchievementService.ownedMap(player),
	}
end

-- ——— SubmitRun ———
Remotes.SubmitRun.OnServerInvoke = function(player, payload)
	payload = payload or {}
	local levelId = tonumber(payload.levelId) or 0
	local won = payload.won == true
	local runDeaths = math.clamp(tonumber(payload.runDeaths) or 0, 0, 9999)
	local timeMs = math.clamp(tonumber(payload.timeMs) or 0, 0, 3600000)
	local coins = math.clamp(tonumber(payload.coins) or 0, 0, 500)

	local profile = DataService.loadProfile(player)
	local progress = DataService.loadProgress(player)
	local prev = progress[levelId]

	local firstClear = won and not (prev and prev.completed)
	local earned = 0
	if won then
		earned = coins * Catalog.COIN_VALUE + Catalog.CLEAR_REWARD
		if firstClear then earned += Catalog.FIRST_CLEAR_BONUS end
		if runDeaths == 0 then earned += deathlessBonusFor(levelId) end
		if timeMs > 0 and timeMs <= (parFor(levelId) or math.huge) * 1000 then earned += Catalog.SPEED_BONUS end

		local bestDeaths = prev and prev.bestDeaths
		local bestTimeMs = prev and prev.bestTimeMs
		if not prev then
			prev = { completed = false, attempts = 0 }
			progress[levelId] = prev
		end
		prev.completed = true
		prev.attempts = (prev.attempts or 0) + 1
		prev.bestDeaths = if bestDeaths ~= nil then math.min(bestDeaths, runDeaths) else runDeaths
		prev.bestTimeMs = if bestTimeMs ~= nil and bestTimeMs > 0 then math.min(bestTimeMs, timeMs) else timeMs
	else
		if prev then
			prev.attempts = (prev.attempts or 0) + 1
		elseif runDeaths > 0 then
			progress[levelId] = { completed = false, attempts = 1 }
		end
	end

	profile.coins += earned
	profile.totalDeaths += runDeaths

	DataService.saveProfile(player)
	DataService.saveProgress(player)

	-- leaderboards
	local cleared = AchievementService.clearedCount(progress)
	LeaderboardService.submit(player, cleared, profile.totalDeaths, if won then timeMs else 0)

	-- achievements
	local newAchievements = AchievementService.evaluate(player, {
		deaths = runDeaths, won = won, timeMs = timeMs, coins = profile.coins,
		levelId = levelId, par = parFor(levelId), progress = progress, profile = profile,
	})
	DataService.saveAchievements(player)

	return {
		coinsEarned = earned,
		firstClear = firstClear,
		newAchievements = newAchievements,
		profile = profile,
		unlockedLevel = unlockedFor(progress, profile),
	}
end

-- ——— BuyItem ———
Remotes.BuyItem.OnServerInvoke = function(player, payload)
	payload = payload or {}
	local itemId = payload.itemId
	local item = ITEM_MAP[itemId]
	if not item then return { ok = false, error = "unknown item" } end

	local profile = DataService.loadProfile(player)
	local purchases = DataService.loadPurchases(player)

	-- already own a permanent item?
	if item.consumable == false and purchases[itemId] ~= nil then
		return { ok = false, error = "already owned", coins = profile.coins }
	end
	if profile.coins < item.price then
		return { ok = false, error = "not enough coins", coins = profile.coins }
	end

	profile.coins -= item.price
	if item.consumable then
		DataService.addConsumable(player, itemId, 1)
	else
		DataService.markOwned(player, itemId)
	end
	DataService.saveProfile(player)
	DataService.savePurchases(player)

	-- shopper achievement may trigger on any paid purchase
	local newAch = {}
	if item.price > 0 then
		newAch = AchievementService.evaluate(player, { profile = profile })
		DataService.saveAchievements(player)
	end

	return {
		ok = true, coins = profile.coins,
		owned = DataService.loadPurchases(player),
		newAchievements = newAch,
	}
end

-- ——— UseItem (consume one gear charge) ———
Remotes.UseItem.OnServerInvoke = function(player, payload)
	payload = payload or {}
	local itemId = payload.itemId
	local item = ITEM_MAP[itemId]
	if not item or item.category ~= "gear" then
		return { ok = false, error = "not gear" }
	end
	local ok = DataService.consume(player, itemId)
	if not ok then return { ok = false, error = "none left" } end
	DataService.savePurchases(player)

	local out = { ok = true, qty = DataService.getQty(player, itemId) }
	if itemId == "gear:skip" then
		-- permanently unlock one extra level beyond the natural progression
		local profile = DataService.loadProfile(player)
		profile.unlockBoost = (profile.unlockBoost or 0) + 1
		DataService.saveProfile(player)
		out.unlockedLevel = unlockedFor(DataService.loadProgress(player), profile)
		out.profile = profile
	end
	return out
end

-- ——— PatchSettings ———
Remotes.PatchSettings.OnServerInvoke = function(player, patch)
	patch = patch or {}
	local settings = DataService.loadSettings(player)
	local allowed = { theme = true, sound = true, volume = true, shake = true, skin = true, trail = true, taunt = true }
	for k, v in pairs(patch) do
		if allowed[k] then settings[k] = v end
	end
	DataService.saveSettings(player)
	return { settings = settings }
end

-- ——— FetchLeaderboard ———
Remotes.FetchLeaderboard.OnServerInvoke = function(_player, n)
	return LeaderboardService.fetch(tonumber(n) or 25)
end

-- ——— FetchAchievements ———
Remotes.FetchAchievements.OnServerInvoke = function(player)
	return {
		owned = AchievementService.ownedMap(player),
		defs = Catalog.ACHIEVEMENTS,
	}
end

print("[EXOTIC] server remotes wired")
