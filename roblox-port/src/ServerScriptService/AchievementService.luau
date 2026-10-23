--!strict
-- EXOTIC achievements — server-side evaluation, mirrors the web progress
-- route's achievement logic in src/app/api/progress. Persists unlocks so an
-- achievement only ever fires once.

local DataService = require(script.Parent:WaitForChild("DataService"))

local AchievementService = {}

-- keys in the canonical order used by the UI
AchievementService.KEYS = {
	"first-death", "first-clear", "deaths-25", "deaths-100", "deaths-250",
	"flawless", "speedrun", "trio", "full-clear", "hoarder", "shopper",
}

function AchievementService.clearedCount(progress)
	local c = 0
	for _, p in pairs(progress) do
		if p.completed then c += 1 end
	end
	return c
end

-- data: { deaths, won, timeMs, coins, levelId, par, progress, profile }
-- Returns array of newly-unlocked keys (already persisted).
function AchievementService.evaluate(player, data)
	local newly = {}
	local function unlock(key)
		if DataService.unlockAchievement(player, key) then
			table.insert(newly, key)
		end
	end

	local profile = data.profile or DataService.loadProfile(player)
	local progress = data.progress or DataService.loadProgress(player)
	local totalDeaths = profile.totalDeaths or 0
	local cleared = AchievementService.clearedCount(progress)
	local totalLevels = #require(game:GetService("ReplicatedStorage"):WaitForChild("Shared"):WaitForChild("Catalog")).LEVEL_META

	if (data.deaths or 0) > 0 or totalDeaths > 0 then unlock("first-death") end
	if totalDeaths >= 25 then unlock("deaths-25") end
	if totalDeaths >= 100 then unlock("deaths-100") end
	if totalDeaths >= 250 then unlock("deaths-250") end

	if data.won then
		unlock("first-clear")
		if (data.deaths or 0) == 0 then unlock("flawless") end
		local par = data.par
		if par and par > 0 and (data.timeMs or 0) > 0 and (data.timeMs or 0) <= par * 1000 then
			unlock("speedrun")
		end
		if cleared >= 3 then unlock("trio") end
		if cleared >= totalLevels then unlock("full-clear") end
	end

	if (profile.coins or 0) >= 500 then unlock("hoarder") end

	-- shopper: any non-free purchase owned
	local purchases = DataService.loadPurchases(player)
	local Catalog = require(game:GetService("ReplicatedStorage"):WaitForChild("Shared"):WaitForChild("Catalog"))
	for _, item in ipairs(Catalog.SHOP_ITEMS) do
		if item.price > 0 and purchases[item.id] ~= nil then
			unlock("shopper")
			break
		end
	end

	return newly
end

function AchievementService.ownedMap(player)
	local ach = DataService.loadAchievements(player)
	local map = {}
	for _, key in ipairs(AchievementService.KEYS) do
		map[key] = ach[key] or 0
	end
	return map
end

return AchievementService
