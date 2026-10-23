--!strict
-- EXOTIC Locked screen — shown when a level is locked (port of the locked
-- branch in src/components/game-screen.tsx).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local App = require(Shared:WaitForChild("App"))
local Ui = require(Shared:WaitForChild("Ui"))
local Remotes = require(Shared:WaitForChild("Remotes"))
local Audio = require(Shared:WaitForChild("Audio"))

local Locked = {}
Locked.__index = Locked

function Locked.build()
	local self = setmetatable({}, Locked)
	local tok = Ui.tokens(App.state.theme)
	local screen = Instance.new("Frame")
	screen.Name = "Locked"
	screen.Size = UDim2.new(1, 0, 1, 0)
	screen.BackgroundColor3 = tok.bg
	screen.BorderSizePixel = 0
	screen.Visible = false
	screen.Parent = App.root
	self.screen = screen

	local col = Instance.new("UIListLayout")
	col.VerticalAlignment = Enum.VerticalAlignment.Center
	col.HorizontalAlignment = Enum.HorizontalAlignment.Center
	col.Padding = UDim.new(0, 14)
	col.Parent = screen

	local badge = Instance.new("TextLabel")
	badge.Size = UDim2.new(0, 80, 0, 80)
	badge.BackgroundColor3 = tok.fg
	badge.TextColor3 = tok.bg
	badge.Text = "🔒"
	badge.FontFace = Ui.FONT_MONO_BOLD
	badge.TextSize = 34
	badge.BorderSizePixel = 0
	badge.LayoutOrder = 1
	badge.Parent = screen
	Ui.corner(badge, 40)

	self.title = Ui.label({ parent = screen, text = "LOCKED.", color = tok.fg, font = Ui.FONT_HEAD, textSize = 48, size = UDim2.new(0, 400, 0, 60), xAlign = Enum.TextXAlignment.Center, order = 2 })
	self.sub = Ui.label({ parent = screen, text = "", color = tok.mut, font = Ui.FONT_MONO, textSize = 12, size = UDim2.new(0, 480, 0, 20), xAlign = Enum.TextXAlignment.Center, order = 3 })

	local row = Instance.new("Frame")
	row.AutomaticSize = Enum.AutomaticSize.X
	row.Size = UDim2.new(0, 0, 0, 46)
	row.BackgroundTransparency = 1
	row.LayoutOrder = 4
	row.Parent = screen
	local rl = Instance.new("UIListLayout"); rl.FillDirection = Enum.FillDirection.Horizontal; rl.Padding = UDim.new(0, 10); rl.Parent = row
	Ui.pill({ parent = row, label = "← Level Select", variant = "solid", theme = App.state.theme, onClick = function() App.navigate("Levels") end })
	self.skipBtn = Ui.pill({ parent = row, label = "⏩ Use Skip Token", variant = "soft", theme = App.state.theme, onClick = function() self:useSkip() end })

	return self
end

function Locked:useSkip()
	task.spawn(function()
		local ok, res = pcall(function() return Remotes.UseItem:InvokeServer({ itemId = "gear:skip" }) end)
		if ok and res and res.ok then
			if res.profile then App.state.profile = res.profile end
			if res.unlockedLevel then App.state.unlockedLevel = res.unlockedLevel end
			Audio.sfx.buy()
			App.notify("LEVEL UNLOCKED", "THE SUFFERING EXTENDS", "silent")
			if self.levelId then App.navigate("Play", self.levelId) end
		else
			App.notify("NO SKIP TOKEN", "THE SHOP SELLS THEM", "error")
		end
	end)
end

function Locked:onEnter(levelId)
	self.levelId = levelId or 1
	self.sub.Text = string.format("CLEAR LEVEL %d FIRST. OR PAY TO SKIP.", math.max(1, (App.state.unlockedLevel or 1) - 1))
	self.skipBtn.Visible = App.ownedQty("gear:skip") > 0
end

function Locked:onExit() end

return Locked
