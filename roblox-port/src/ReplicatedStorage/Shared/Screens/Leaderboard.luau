--!strict
-- EXOTIC Leaderboard screen — port of src/app/leaderboard/page.tsx. Three
-- tabs (most cleared / fewest deaths / fastest), fetched from the server.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local App = require(Shared:WaitForChild("App"))
local Ui = require(Shared:WaitForChild("Ui"))
local Remotes = require(Shared:WaitForChild("Remotes"))
local Utils = require(Shared:WaitForChild("Utils"))
local Audio = require(Shared:WaitForChild("Audio"))

local Leaderboard = {}
Leaderboard.__index = Leaderboard

local TABS = {
	{ key = "cleared", label = "MOST CLEARED", fmt = function(v) return tostring(v) end },
	{ key = "deaths", label = "FEWEST DEATHS", fmt = function(v) return tostring(v) end },
	{ key = "speed", label = "FASTEST", fmt = function(v) return Utils.fmtTime(v) end },
}

function Leaderboard.build()
	local self = setmetatable({}, Leaderboard)
	local shell = Ui.shell({
		parent = App.root, name = "Leaderboard", title = "LEADERBOARD", backLabel = "← Home",
		onBack = function() App.navigate("Home") end, theme = App.state.theme, visible = false,
	})
	self.screen = shell.screen
	self.body = shell.body
	self.active = "cleared"
	self.data = {}

	local tabs = Instance.new("Frame")
	tabs.Size = UDim2.new(1, 0, 0, 38)
	tabs.BackgroundTransparency = 1
	tabs.Parent = shell.body
	local tl = Instance.new("UIListLayout"); tl.FillDirection = Enum.FillDirection.Horizontal; tl.Padding = UDim.new(0, 8); tl.Parent = tabs
	self.tabBtns = {}
	for _, tab in ipairs(TABS) do
		local b = Ui.pill({ parent = tabs, label = tab.label, variant = "soft", size = "sm", theme = App.state.theme, order = #self.tabBtns + 1, onClick = function() self:setTab(tab.key) end })
		table.insert(self.tabBtns, { btn = b, key = tab.key })
	end

	local list = Instance.new("Frame")
	list.Size = UDim2.new(1, 0, 0, 0)
	list.AutomaticSize = Enum.AutomaticSize.Y
	list.Position = UDim2.new(0, 0, 0, 48)
	list.BackgroundTransparency = 1
	list.Parent = shell.body
	local ll = Instance.new("UIListLayout"); ll.Padding = UDim.new(0, 6); ll.Parent = list
	self.list = list
	return self
end

function Leaderboard:setTab(key)
	self.active = key
	self:render()
end

function Leaderboard:fetch()
	task.spawn(function()
		local ok, res = pcall(function() return Remotes.FetchLeaderboard:InvokeServer(25) end)
		if ok and res then
			self.data = res
			self:render()
		end
	end)
end

function Leaderboard:render()
	for _, c in ipairs(self.list:GetChildren()) do
		if c:IsA("Frame") then c:Destroy() end
	end
	local tok = Ui.tokens(App.state.theme)
	local tabDef = nil
	for _, t in ipairs(TABS) do if t.key == self.active then tabDef = t end end
	local rows = self.data[self.active] or {}
	if #rows == 0 then
		Ui.label({ parent = self.list, text = "NO RUNS YET. BE THE FIRST TO SUFFER.", color = tok.mut, font = Ui.FONT_MONO, textSize = 13, size = UDim2.new(1, 0, 0, 40), xAlign = Enum.TextXAlignment.Left })
		return
	end
	for order, row in ipairs(rows) do
		local entry = Instance.new("Frame")
		entry.Size = UDim2.new(1, 0, 0, 40)
		entry.BackgroundColor3 = tok.pan
		entry.BorderSizePixel = 0
		entry.LayoutOrder = order
		entry.Parent = self.list
		Ui.corner(entry, 10)
		Ui.label({ parent = entry, text = "#" .. row.rank, color = tok.mut, font = Ui.FONT_MONO_BOLD, textSize = 13, size = UDim2.new(0, 40, 1, 0), xAlign = Enum.TextXAlignment.Left }).Position = UDim2.new(0, 12, 0, 0)
		Ui.label({ parent = entry, text = row.name, color = tok.fg, font = Ui.FONT_MONO_BOLD, textSize = 13, size = UDim2.new(1, -180, 1, 0), xAlign = Enum.TextXAlignment.Left }).Position = UDim2.new(0, 56, 0, 0)
		local v = Ui.label({ parent = entry, text = tabDef.fmt(row.value), color = tok.fg, font = Ui.FONT_MONO_BOLD, textSize = 14, size = UDim2.new(0, 120, 1, 0), xAlign = Enum.TextXAlignment.Right })
		v.Position = UDim2.new(1, -140, 0, 0)
	end
end

function Leaderboard:onEnter()
	self:render()
	self:fetch()
end

function Leaderboard:onExit() end

return Leaderboard
