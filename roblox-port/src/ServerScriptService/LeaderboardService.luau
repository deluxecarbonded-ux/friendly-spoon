--!strict
-- EXOTIC leaderboards — three OrderedDataStores mirroring the web leaderboard
-- route (most cleared / fewest deaths / fastest). Adds display-name lookup so
-- the client can render real usernames.

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local LeaderboardService = {}

local clearedBoard = DataStoreService:GetOrderedDataStore("LB_Cleared")
local deathsBoard = DataStoreService:GetOrderedDataStore("LB_Deaths")
local speedBoard = DataStoreService:GetOrderedDataStore("LB_Speed")

function LeaderboardService.submit(player, cleared, deaths, timeMs)
	pcall(function() clearedBoard:SetAsync(tostring(player.UserId), cleared) end)
	pcall(function() deathsBoard:SetAsync(tostring(player.UserId), deaths) end)
	if timeMs and timeMs > 0 then
		pcall(function() speedBoard:SetAsync(tostring(player.UserId), timeMs) end)
	end
end

local function displayNames(userIds)
	local names = {}
	for _, id in ipairs(userIds) do
		local ok, name = pcall(function() return Players:GetNameFromUserIdAsync(id) end)
		names[id] = if ok then name else ("Player_" .. id)
	end
	return names
end

-- ascending=false → highest first (cleared); ascending=true → lowest first
-- (deaths, speed). Returns { {rank, userId, name, value}, ... }
local function query(store, ascending, n)
	local ok, pages = pcall(function() return store:GetSortedAsync(ascending, n) end)
	if not ok then return {} end
	local rows = {}
	local page = pages:GetCurrentPage()
	local userIds = {}
	for _, entry in ipairs(page) do
		local id = tonumber(entry.key)
		if id then
			table.insert(rows, { userId = id, value = entry.value })
			table.insert(userIds, id)
		end
	end
	local names = displayNames(userIds)
	for rank, row in ipairs(rows) do
		row.rank = rank
		row.name = names[row.userId] or ("Player_" .. row.userId)
	end
	return rows
end

function LeaderboardService.topCleared(n) return query(clearedBoard, false, n or 50) end
function LeaderboardService.topDeaths(n) return query(deathsBoard, true, n or 50) end
function LeaderboardService.topSpeed(n) return query(speedBoard, true, n or 50) end

function LeaderboardService.fetch(n)
	return {
		cleared = LeaderboardService.topCleared(n),
		deaths = LeaderboardService.topDeaths(n),
		speed = LeaderboardService.topSpeed(n),
	}
end

return LeaderboardService
