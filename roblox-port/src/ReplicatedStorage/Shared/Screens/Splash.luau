--!strict
-- EXOTIC Splash — animated boot splash (port of src/components/splash.tsx).
-- Cycles loading lines for ~2.6s then navigates to Home.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local App = require(Shared:WaitForChild("App"))
local Ui = require(Shared:WaitForChild("Ui"))
local Audio = require(Shared:WaitForChild("Audio"))

local Splash = {}
Splash.__index = Splash

local LINES = {
	"BOOTING EXOTIC…",
	"CALIBRATING TRAPS…",
	"ARMING SPIKES…",
	"DOUBTING FLOORS…",
	"READY.",
}

function Splash.build()
	local self = setmetatable({}, Splash)
	local tok = Ui.tokens("dark")
	local screen = Instance.new("Frame")
	screen.Name = "Splash"
	screen.Size = UDim2.new(1, 0, 1, 0)
	screen.BackgroundColor3 = tok.bg
	screen.BorderSizePixel = 0
	screen.Visible = false
	screen.ZIndex = 50
	screen.Parent = App.root
	self.screen = screen

	local col = Instance.new("UIListLayout")
	col.VerticalAlignment = Enum.VerticalAlignment.Center
	col.HorizontalAlignment = Enum.HorizontalAlignment.Center
	col.Padding = UDim.new(0, 10)
	col.Parent = screen

	local brand = Ui.label({ parent = screen, text = "◆ EXOTIC", color = tok.fg, font = Ui.FONT_HEAD, textSize = 44, size = UDim2.new(0, 400, 0, 60), xAlign = Enum.TextXAlignment.Center, order = 1 })
	self.line = Ui.label({ parent = screen, text = LINES[1], color = tok.mut, font = Ui.FONT_MONO_BOLD, textSize = 13, size = UDim2.new(0, 400, 0, 20), xAlign = Enum.TextXAlignment.Center, order = 2 })
	return self
end

function Splash:onEnter()
	Audio.sfx.boot()
	self.screen.Visible = true
	task.delay(2.6, function()
		if self.screen and self.screen.Parent then
			self.screen.Visible = false
			local ok, err = pcall(function() App.navigate("Home") end)
			if not ok then warn("[EXOTIC] Splash→Home failed: " .. tostring(err)) end
		end
	end)
end

function Splash:onExit() end

return Splash
