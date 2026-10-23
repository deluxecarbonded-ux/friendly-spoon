--!strict
-- EXOTIC Achievements screen — port of src/app/achievements/page.tsx.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local App = require(Shared:WaitForChild("App"))
local Ui = require(Shared:WaitForChild("Ui"))
local Catalog = require(Shared:WaitForChild("Catalog"))
local Remotes = require(Shared:WaitForChild("Remotes"))

local Achievements = {}
Achievements.__index = Achievements

local GLYPHS = {
	["first-death"] = "☠", ["first-clear"] = "⚑", ["deaths-25"] = "✕",
	["deaths-100"] = "✕", ["deaths-250"] = "✕", ["flawless"] = "★",
	["speedrun"] = "⏱", ["trio"] = "③", ["full-clear"] = "♛",
	["hoarder"] = "●", ["shopper"] = "▣",
}

function Achievements.build()
	local self = setmetatable({}, Achievements)
	local shell = Ui.shell({
		parent = App.root, name = "Achievements", title = "ACHIEVEMENTS", backLabel = "← Home",
		onBack = function() App.navigate("Home") end, theme = App.state.theme, visible = false,
	})
	self.screen = shell.screen
	self.body = shell.body

	local grid = Instance.new("Frame")
	grid.Size = UDim2.new(1, 0, 0, 0)
	grid.AutomaticSize = Enum.AutomaticSize.Y
	grid.BackgroundTransparency = 1
	grid.Parent = shell.body
	local gl = Instance.new("UIGridLayout")
	gl.CellSize = UDim2.new(0.5, -8, 0, 92)
	gl.CellPadding = UDim2.new(0, 16, 0, 12)
	gl.SortOrder = Enum.SortOrder.LayoutOrder
	gl.Parent = grid
	self.grid = grid
	self.cards = {}

	for order, def in ipairs(Catalog.ACHIEVEMENTS) do
		table.insert(self.cards, self:buildCard(def, order))
	end
	return self
end

function Achievements:buildCard(def, order)
	local tok = Ui.tokens(App.state.theme)
	local card = Instance.new("Frame")
	card.BackgroundColor3 = tok.pan
	card.BorderSizePixel = 0
	card.LayoutOrder = order
	card.Parent = self.grid
	Ui.corner(card, 12)

	local icon = Instance.new("TextLabel")
	icon.Size = UDim2.new(0, 40, 0, 40)
	icon.Position = UDim2.new(0, 12, 0, 14)
	icon.BackgroundColor3 = tok.pan2
	icon.TextColor3 = tok.mut
	icon.FontFace = Ui.FONT_MONO_BOLD
	icon.TextSize = 20
	icon.Text = GLYPHS[def.key] or "★"
	icon.BorderSizePixel = 0
	icon.Parent = card
	Ui.corner(icon, 20)

	local name = Ui.label({ parent = card, text = def.name, color = tok.fg, font = Ui.FONT_MONO_BOLD, textSize = 13, size = UDim2.new(1, -72, 0, 20), xAlign = Enum.TextXAlignment.Left, order = 2 })
	name.Position = UDim2.new(0, 60, 0, 14)
	local desc = Ui.label({ parent = card, text = def.desc, color = tok.mut, font = Ui.FONT_MONO, textSize = 11, size = UDim2.new(1, -72, 0, 32), xAlign = Enum.TextXAlignment.Left, wrapped = true, order = 3 })
	desc.Position = UDim2.new(0, 60, 0, 34)
	local state = Ui.label({ parent = card, text = "LOCKED", color = tok.mut, font = Ui.FONT_MONO_BOLD, textSize = 10, size = UDim2.new(0, 80, 0, 16), xAlign = Enum.TextXAlignment.Left, order = 4 })
	state.Position = UDim2.new(0, 60, 1, -22)

	return { card = card, icon = icon, state = state, def = def }
end

function Achievements:refresh()
	local owned = App.state.achievements or {}
	local tok = Ui.tokens(App.state.theme)
	for _, c in ipairs(self.cards) do
		local ts = owned[c.def.key]
		local unlocked = ts ~= nil and ts > 0
		c.state.Text = if unlocked then "UNLOCKED" else "LOCKED"
		c.state.TextColor3 = if unlocked then tok.fg else tok.mut
		c.icon.BackgroundColor3 = if unlocked then tok.fg else tok.pan2
		c.icon.TextColor3 = if unlocked then tok.bg else tok.mut
		c.card.BackgroundTransparency = if unlocked then 0 else 0.25
	end
end

function Achievements:onEnter()
	self:refresh()
	task.spawn(function()
		local ok, res = pcall(function() return Remotes.FetchAchievements:InvokeServer() end)
		if ok and res and res.owned then
			App.state.achievements = res.owned
			self:refresh()
		end
	end)
end

function Achievements:onExit() end

return Achievements
