--!strict
-- EXOTIC remotes — lazily created RemoteFunctions/Events shared by client and
-- server, plus a tiny typed client-side invoke helper.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Remotes = {}

-- The server owns remote creation (instances created client-side stay local and
-- never get a server handler). The client waits for the server's instance.
local function getOrCreate(name: string, className: string)
	if RunService:IsServer() then
		local r = ReplicatedStorage:FindFirstChild(name)
		if not r then
			r = Instance.new(className)
			r.Name = name
			r.Parent = ReplicatedStorage
		end
		return r
	end
	-- Finite wait: if the server script died (e.g. Data Stores disabled in
	-- Studio), the UI must still boot instead of hanging forever.
	local r = ReplicatedStorage:WaitForChild(name, 15)
	if not r then
		warn("[EXOTIC] remote '" .. name .. "' not created by server (is Studio API access enabled?) — continuing without it")
	end
	return r
end

Remotes.SubmitRun = getOrCreate("Exotic_SubmitRun", "RemoteFunction")
Remotes.BuyItem = getOrCreate("Exotic_BuyItem", "RemoteFunction")
Remotes.UseItem = getOrCreate("Exotic_UseItem", "RemoteFunction")
Remotes.PatchSettings = getOrCreate("Exotic_PatchSettings", "RemoteFunction")
Remotes.FetchState = getOrCreate("Exotic_FetchState", "RemoteFunction")
Remotes.FetchLeaderboard = getOrCreate("Exotic_FetchLeaderboard", "RemoteFunction")
Remotes.FetchAchievements = getOrCreate("Exotic_FetchAchievements", "RemoteFunction")
Remotes.Realtime = getOrCreate("Exotic_Realtime", "RemoteEvent")

return Remotes
