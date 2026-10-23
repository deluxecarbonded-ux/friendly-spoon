--!strict
-- EXOTIC Credits screen — port of src/app/credits/page.tsx.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local App = require(Shared:WaitForChild("App"))
local Ui = require(Shared:WaitForChild("Ui"))

local Credits = {}
Credits.__index = Credits

local ROLES = {
	{ "GAME DIRECTION", "THE EXOTIC TEAM" },
	{ "TROLL PHYSICS", "THE EXOTIC TEAM" },
	{ "TRAP ARCHITECTURE", "THE EXOTIC TEAM" },
	{ "UI & MOTION DESIGN", "THE EXOTIC TEAM" },
	{ "SOUND SYNTHESIS", "THE EXOTIC TEAM — MADE OF MATH, LIVE" },
	{ "QUALITY ASSURANCE", "FAILED ON PURPOSE" },
	{ "PLAYER EMOTIONAL SUPPORT", "NOT AVAILABLE" },
}

function Credits.build()
	local self = setmetatable({}, Credits)
	local shell = Ui.shell({
		parent = App.root, name = "Credits", title = "CREDITS", backLabel = "← Home",
		sub = "EVERY SQUARE, EVERY BETRAYAL — DESIGNED AND ENGINEERED BY HUMANS.",
		onBack = function() App.navigate("Home") end, theme = App.state.theme, visible = false,
	})
	self.screen = shell.screen
	self.body = shell.body
	local tok = Ui.tokens(App.state.theme)

	local intro = Ui.label({ parent = self.body, text = "EXOTIC was built by hand: every tile placed to be trusted once, every flag raised to be doubted forever. No asset stores, no template levels — just humans who understand exactly where you'll jump.", color = tok.fg, font = Ui.FONT_MONO, textSize = 16, size = UDim2.new(1, -40, 0, 90), wrapped = true, order = 1 })

	local roles = Instance.new("Frame")
	roles.Size = UDim2.new(1, 0, 0, 0)
	roles.AutomaticSize = Enum.AutomaticSize.Y
	roles.Position = UDim2.new(0, 0, 0, 110)
	roles.BackgroundTransparency = 1
	roles.Parent = self.body
	local rl = Instance.new("UIListLayout"); rl.Padding = UDim.new(0, 4); rl.Parent = roles
	for i, role in ipairs(ROLES) do
		local row = Instance.new("Frame")
		row.Size = UDim2.new(1, 0, 0, 40)
		row.BackgroundTransparency = 1
		row.LayoutOrder = i
		row.Parent = roles
		Ui.label({ parent = row, text = role[1], color = tok.mut, font = Ui.FONT_MONO_BOLD, textSize = 11, size = UDim2.new(0.5, 0, 1, 0), xAlign = Enum.TextXAlignment.Left })
		local who = Ui.label({ parent = row, text = role[2], color = tok.fg, font = Ui.FONT_MONO_BOLD, textSize = 12, size = UDim2.new(0.5, 0, 1, 0), xAlign = Enum.TextXAlignment.Right })
		who.Position = UDim2.new(0.5, 0, 0, 0)
	end

	-- permanent record
	local record = Instance.new("Frame")
	record.Size = UDim2.new(1, 0, 0, 140)
	record.Position = UDim2.new(0, 0, 0, 110 + #ROLES * 44 + 20)
	record.BackgroundColor3 = tok.fg
	record.BorderSizePixel = 0
	record.Parent = self.body
	Ui.corner(record, 20)
	Ui.pad(record, 24, 20, 24, 20)
	Ui.label({ parent = record, text = "YOUR PERMANENT RECORD", color = tok.bg, font = Ui.FONT_MONO_BOLD, textSize = 10, size = UDim2.new(1, 0, 0, 16), transparency = 0.4, xAlign = Enum.TextXAlignment.Left })
	local stats = Instance.new("Frame")
	stats.Size = UDim2.new(1, 0, 1, -24)
	stats.Position = UDim2.new(0, 0, 0, 24)
	stats.BackgroundTransparency = 1
	stats.Parent = record
	local sl = Instance.new("UIListLayout"); sl.FillDirection = Enum.FillDirection.Horizontal; sl.Padding = UDim.new(0, 40); sl.Parent = stats
	self.statCol = {}
	for _, def in ipairs({ { "DEATHS", "deaths" }, { "CLEARED", "cleared" }, { "COINS", "coins" } }) do
		local col = Instance.new("Frame")
		col.Size = UDim2.new(0, 100, 1, 0)
		col.AutomaticSize = Enum.AutomaticSize.X
		col.BackgroundTransparency = 1
		col.Parent = stats
		local v = Ui.label({ parent = col, text = "0", color = tok.bg, font = Ui.FONT_HEAD, textSize = 34, size = UDim2.new(0, 0, 0, 42), automatic = Enum.AutomaticSize.X, xAlign = Enum.TextXAlignment.Left })
		local l = Ui.label({ parent = col, text = def[1], color = tok.bg, font = Ui.FONT_MONO_BOLD, textSize = 10, size = UDim2.new(0, 0, 0, 14), automatic = Enum.AutomaticSize.X, transparency = 0.4, xAlign = Enum.TextXAlignment.Left })
		self.statCol[def[2]] = v
	end

	local ded = Ui.label({ parent = self.body, text = "DEDICATED TO EVERYONE WHO TRUSTED THE FLOOR.\nTHE FLOOR THANKS YOU. THE FLOOR IS GONE.", color = tok.mut, font = Ui.FONT_MONO, textSize = 12, size = UDim2.new(1, 0, 0, 40), wrapped = true, order = 10 })
	ded.Position = UDim2.new(0, 0, 0, record.Position.Y.Offset + 160)
	local copy = Ui.label({ parent = self.body, text = "© EXOTIC CO. — NO SPIKES WERE HARMED.", color = tok.mut, font = Ui.FONT_MONO_BOLD, textSize = 10, size = UDim2.new(1, 0, 0, 16), order = 11 })
	copy.Position = UDim2.new(0, 0, 0, record.Position.Y.Offset + 210)

	return self
end

function Credits:refresh()
	local profile = App.state.profile or {}
	local progress = App.state.progress or {}
	local cleared = 0
	for _, p in pairs(progress) do if p.completed then cleared += 1 end end
	self.statCol.deaths.Text = tostring(profile.totalDeaths or 0)
	self.statCol.cleared.Text = cleared .. "/6"
	self.statCol.coins.Text = tostring(App.coins())
end

function Credits:onEnter()
	self:refresh()
end

function Credits:onExit() end

return Credits
