--!strict
-- EXOTIC Levels screen — port of src/app/levels/page.tsx. Level cards with
-- live bot previews, cleared/locked state, par times and skip-token unlock.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local App = require(Shared:WaitForChild("App"))
local Ui = require(Shared:WaitForChild("Ui"))
local Catalog = require(Shared:WaitForChild("Catalog"))
local Levels = require(Shared:WaitForChild("Levels"))
local Preview = require(Shared:WaitForChild("Preview"))
local Remotes = require(Shared:WaitForChild("Remotes"))
local Audio = require(Shared:WaitForChild("Audio"))

local LevelsScreen = {}
LevelsScreen.__index = LevelsScreen

function LevelsScreen.build()
	local self = setmetatable({}, LevelsScreen)
	local shell = Ui.shell({
		parent = App.root, name = "Levels", title = "LEVELS", backLabel = "← Home",
		onBack = function() App.navigate("Home") end, theme = App.state.theme, visible = false,
	})
	self.screen = shell.screen
	self.body = shell.body
	self.shell = shell
	self.cards = {}

	local grid = Instance.new("Frame")
	grid.Size = UDim2.new(1, 0, 0, 0)
	grid.AutomaticSize = Enum.AutomaticSize.Y
	grid.BackgroundTransparency = 1
	grid.Parent = shell.body
	local gl = Instance.new("UIGridLayout")
	gl.CellSize = UDim2.new(0.5, -8, 0, 220)
	gl.CellPadding = UDim2.new(0, 16, 0, 16)
	gl.SortOrder = Enum.SortOrder.LayoutOrder
	gl.Parent = grid
	self.grid = grid

	for i = 1, #Catalog.LEVEL_META do
		table.insert(self.cards, self:buildCard(grid, i))
	end
	return self
end

function LevelsScreen:buildCard(parent, index)
	local meta = Catalog.LEVEL_META[index]
	local tok = Ui.tokens(App.state.theme)

	local card = Instance.new("Frame")
	card.BackgroundColor3 = tok.pan
	card.BorderSizePixel = 0
	card.LayoutOrder = index
	card.Parent = parent
	Ui.corner(card, 16)

	-- preview stage
	local previewHolder = Instance.new("Frame")
	previewHolder.Size = UDim2.new(1, -16, 0, 120)
	previewHolder.Position = UDim2.new(0, 8, 0, 8)
	previewHolder.BackgroundColor3 = Color3.fromHex(if App.state.theme == "dark" then "0b0b0c" else "f1f1ee")
	previewHolder.BorderSizePixel = 0
	previewHolder.ClipsDescendants = true
	previewHolder.Parent = card
	Ui.corner(previewHolder, 10)

	local overlay = Instance.new("Frame")
	overlay.Size = UDim2.new(1, 0, 1, 0)
	overlay.BackgroundColor3 = Color3.new(0, 0, 0)
	overlay.BackgroundTransparency = 0.4
	overlay.Visible = false
	overlay.ZIndex = 5
	overlay.Parent = previewHolder
	Ui.corner(overlay, 10)
	local lockIcon = Ui.label({ parent = overlay, text = "🔒", color = Color3.fromHex("fafafa"), font = Ui.FONT_MONO_BOLD, textSize = 28, size = UDim2.new(1, 0, 1, 0), xAlign = Enum.TextXAlignment.Center })
	lockIcon.ZIndex = 6
	self.overlayFor = self.overlayFor or {}
	self.overlayFor[index] = overlay

	local clearedTag = Instance.new("TextLabel")
	clearedTag.Size = UDim2.new(0, 10, 0, 22)
	clearedTag.AutomaticSize = Enum.AutomaticSize.X
	clearedTag.Position = UDim2.new(1, -8, 0, 8)
	clearedTag.AnchorPoint = Vector2.new(1, 0)
	clearedTag.BackgroundColor3 = tok.fg
	clearedTag.TextColor3 = tok.bg
	clearedTag.FontFace = Ui.FONT_MONO_BOLD
	clearedTag.TextSize = 10
	clearedTag.Text = "✓ CLEARED"
	clearedTag.ZIndex = 6
	clearedTag.BorderSizePixel = 0
	clearedTag.Visible = false
	clearedTag.Parent = previewHolder
	Ui.corner(clearedTag, 11)
	Ui.pad(clearedTag, 10, 0, 10, 0)
	self.clearedFor = self.clearedFor or {}
	self.clearedFor[index] = clearedTag

	local openTag = Instance.new("TextLabel")
	openTag.Size = UDim2.new(0, 10, 0, 22)
	openTag.AutomaticSize = Enum.AutomaticSize.X
	openTag.Position = UDim2.new(1, -8, 0, 8)
	openTag.AnchorPoint = Vector2.new(1, 0)
	openTag.BackgroundColor3 = tok.bg
	openTag.TextColor3 = tok.fg
	openTag.FontFace = Ui.FONT_MONO_BOLD
	openTag.TextSize = 10
	openTag.Text = "▶ OPEN"
	openTag.ZIndex = 6
	openTag.BorderSizePixel = 0
	openTag.Visible = false
	openTag.Parent = previewHolder
	Ui.corner(openTag, 11)
	Ui.pad(openTag, 10, 0, 10, 0)
	self.openFor = self.openFor or {}
	self.openFor[index] = openTag

	-- text + play button
	Ui.label({ parent = card, text = meta.name, color = tok.fg, font = Ui.FONT_HEAD, textSize = 18, size = UDim2.new(1, -16, 0, 24), order = 2 }).Position = UDim2.new(0, 8, 0, 136)
	Ui.label({ parent = card, text = meta.sub, color = tok.mut, font = Ui.FONT_MONO, textSize = 12, size = UDim2.new(1, -16, 0, 18), order = 3 }).Position = UDim2.new(0, 8, 0, 160)
	Ui.label({ parent = card, text = string.format("PAR %ds · DEATHLESS +%d", meta.par, meta.deathlessBonus), color = tok.mut, font = Ui.FONT_MONO_BOLD, textSize = 10, size = UDim2.new(1, -16, 0, 16), order = 4 }).Position = UDim2.new(0, 8, 0, 180)

	local play = Ui.pill({ parent = card, label = "▶ PLAY", variant = "solid", size = "sm", theme = App.state.theme, width = 110, order = 5, onClick = function() self:play(index) end })
	play.Position = UDim2.new(1, -8, 0, 178)
	play.AnchorPoint = Vector2.new(1, 0)

	local skip = Ui.pill({ parent = card, label = "⏩ SKIP", variant = "soft", size = "sm", theme = App.state.theme, width = 90, order = 6, onClick = function() self:useSkip(index) end })
	skip.Position = UDim2.new(1, -124, 0, 178)
	skip.AnchorPoint = Vector2.new(1, 0)
	self.skipFor = self.skipFor or {}
	self.skipFor[index] = skip

	return { card = card, previewHolder = previewHolder, player = nil, index = index }
end

function LevelsScreen:play(index)
	Audio.sfx.select()
	App.navigate("Play", index)
end

function LevelsScreen:useSkip(index)
	task.spawn(function()
		local ok, res = pcall(function() return Remotes.UseItem:InvokeServer({ itemId = "gear:skip" }) end)
		if ok and res and res.ok then
			if res.profile then App.state.profile = res.profile end
			if res.unlockedLevel then App.state.unlockedLevel = res.unlockedLevel end
			Audio.sfx.buy()
			App.notify("LEVEL UNLOCKED", "THE SUFFERING EXTENDS", "silent")
			self:refresh()
		else
			App.notify("NO SKIP TOKEN", "THE SHOP SELLS THEM", "error")
		end
	end)
end

function LevelsScreen:refresh()
	local unlocked = App.state.unlockedLevel or 1
	local progress = App.state.progress or {}
	for _, card in ipairs(self.cards) do
		local index = card.index
		local locked = index > unlocked
		local prog = progress[tostring(index)] or progress[index]
		local cleared = prog ~= nil and prog.completed == true
		if self.overlayFor[index] then self.overlayFor[index].Visible = locked end
		if self.clearedFor[index] then self.clearedFor[index].Visible = cleared end
		if self.openFor[index] then self.openFor[index].Visible = (not locked) and (not cleared) end
		if self.skipFor[index] then
			-- web only offers skip on the single next-locked level (m.id === unlockedLevel + 1)
			self.skipFor[index].Visible = locked and index == unlocked + 1 and App.ownedQty("gear:skip") > 0
		end
	end
end

function LevelsScreen:startPreviews()
	for _, card in ipairs(self.cards) do
		local spec = Preview.Preview.levelPreviewSpec(card.index)
		if spec then
			card.player = Preview.PreviewPlayer.new(card.previewHolder, spec, App.state.theme, 380, 130)
		end
	end
end

function LevelsScreen:onEnter()
	self:refresh()
	if not self.previewsStarted then
		self.previewsStarted = true
		task.spawn(function() self:startPreviews() end)
	else
		for _, card in ipairs(self.cards) do
			if card.player then card.player:setPalette(App.state.theme) end
		end
	end
end

function LevelsScreen:onExit()
	-- keep previews running cheaply paused by hiding; destroy to save perf
	for _, card in ipairs(self.cards) do
		if card.player then card.player:destroy(); card.player = nil end
	end
	self.previewsStarted = false
end

return LevelsScreen
