--!strict
-- EXOTIC server persistence — replaces the Postgres profiles/settings/progress/
-- purchases/achievements tables with Roblox DataStores. Adds per-session
-- caching so a player's data is read once and written on change, matching the
-- request/response shape the web API routes expose.

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local DataService = {}

local profileStore = DataStoreService:GetDataStore("ExoticProfiles")
local progressStore = DataStoreService:GetDataStore("ExoticProgress")
local settingsStore = DataStoreService:GetDataStore("ExoticSettings")
local purchasesStore = DataStoreService:GetDataStore("ExoticPurchases")
local achievementsStore = DataStoreService:GetDataStore("ExoticAchievements")

local DEFAULT_PROFILE = { coins = 0, totalDeaths = 0, unlockBoost = 0 }
local DEFAULT_SETTINGS = { theme = "dark", sound = true, volume = 60, shake = true, skin = "skin:solid", trail = "trail:none", taunt = "taunt:classic" }

-- userId -> cached doc
local cache: { [number]: any } = {}

local function keyOf(player, prefix)
	return prefix .. "_" .. player.UserId
end

local function readStore(store, key, fallback)
	local ok, data = pcall(function() return store:GetAsync(key) end)
	if ok and data ~= nil then return data end
	return fallback
end

local function writeStore(store, key, data)
	pcall(function() store:SetAsync(key, data) end)
end

function DataService.ensure(player)
	local userId = player.UserId
	local session = cache[userId]
	if session then return session end
	session = {
		profile = readStore(profileStore, keyOf(player, "p"), nil),
		progress = readStore(progressStore, keyOf(player, "pr"), nil),
		settings = readStore(settingsStore, keyOf(player, "s"), nil),
		purchases = readStore(purchasesStore, keyOf(player, "pu"), nil),
		achievements = readStore(achievementsStore, keyOf(player, "a"), nil),
	}
	-- Normalise / default-fill, and migrate fresh installs.
	local profile = session.profile or {}
	profile.coins = profile.coins or 0
	profile.totalDeaths = profile.totalDeaths or 0
	profile.unlockBoost = profile.unlockBoost or 0
	session.profile = profile

	session.progress = session.progress or {}

	local settings = session.settings or {}
	for k, v in pairs(DEFAULT_SETTINGS) do
		if settings[k] == nil then settings[k] = v end
	end
	session.settings = settings

	-- purchases: { [itemId] = true } for permanent, { [itemId] = qty } for consumables
	session.purchases = session.purchases or {}
	-- achievements: { [key] = timestampMs }
	session.achievements = session.achievements or {}

	cache[userId] = session
	return session
end

-- ——— accessors (return live references; call save* to persist) ———
function DataService.loadProfile(player) return DataService.ensure(player).profile end
function DataService.loadProgress(player) return DataService.ensure(player).progress end
function DataService.loadSettings(player) return DataService.ensure(player).settings end
function DataService.loadPurchases(player) return DataService.ensure(player).purchases end
function DataService.loadAchievements(player) return DataService.ensure(player).achievements end

-- consumable quantity (gear). Permanent items are boolean-owned.
function DataService.getQty(player, itemId)
	local purchases = DataService.loadPurchases(player)
	local v = purchases[itemId]
	if v == true then return math.huge end -- permanent
	return tonumber(v) or 0
end

function DataService.addConsumable(player, itemId, delta)
	local purchases = DataService.loadPurchases(player)
	purchases[itemId] = math.max(0, (tonumber(purchases[itemId]) or 0) + delta)
end

function DataService.consume(player, itemId): boolean
	local purchases = DataService.loadPurchases(player)
	local v = purchases[itemId]
	if v == true then return true end -- permanent, unlimited
	local qty = tonumber(v) or 0
	if qty <= 0 then return false end
	purchases[itemId] = qty - 1
	return true
end

function DataService.markOwned(player, itemId)
	DataService.loadPurchases(player)[itemId] = true
end

function DataService.unlockAchievement(player, key): boolean
	local ach = DataService.loadAchievements(player)
	if ach[key] then return false end
	ach[key] = os.time() * 1000
	return true
end

function DataService.saveProfile(player) writeStore(profileStore, keyOf(player, "p"), DataService.loadProfile(player)) end
function DataService.saveProgress(player) writeStore(progressStore, keyOf(player, "pr"), DataService.loadProgress(player)) end
function DataService.saveSettings(player) writeStore(settingsStore, keyOf(player, "s"), DataService.loadSettings(player)) end
function DataService.savePurchases(player) writeStore(purchasesStore, keyOf(player, "pu"), DataService.loadPurchases(player)) end
function DataService.saveAchievements(player) writeStore(achievementsStore, keyOf(player, "a"), DataService.loadAchievements(player)) end

function DataService.saveAll(player)
	DataService.saveProfile(player)
	DataService.saveProgress(player)
	DataService.saveSettings(player)
	DataService.savePurchases(player)
	DataService.saveAchievements(player)
end

Players.PlayerRemoving:Connect(function(player)
	local session = cache[player.UserId]
	if session then
		-- flush then drop the session
		writeStore(profileStore, keyOf(player, "p"), session.profile)
		writeStore(progressStore, keyOf(player, "pr"), session.progress)
		writeStore(settingsStore, keyOf(player, "s"), session.settings)
		writeStore(purchasesStore, keyOf(player, "pu"), session.purchases)
		writeStore(achievementsStore, keyOf(player, "a"), session.achievements)
		cache[player.UserId] = nil
	end
end)

game:BindToClose(function()
	for userId, session in pairs(cache) do
		local player = Players:GetPlayerByUserId(userId)
		if player then
			writeStore(profileStore, keyOf(player, "p"), session.profile)
			writeStore(progressStore, keyOf(player, "pr"), session.progress)
			writeStore(settingsStore, keyOf(player, "s"), session.settings)
			writeStore(purchasesStore, keyOf(player, "pu"), session.purchases)
			writeStore(achievementsStore, keyOf(player, "a"), session.achievements)
		end
	end
end)

return DataService
