--!strict
-- EXOTIC Play screen — a faithful port of src/components/game-screen.tsx.
-- Owns the Engine + Renderer, the HUD, overlays, gear, controls and run sync.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Engine = require(Shared:WaitForChild("Engine"))
local Renderer = require(Shared:WaitForChild("Renderer"))
local Levels = require(Shared:WaitForChild("Levels"))
local Catalog = require(Shared:WaitForChild("Catalog"))
local App = require(Shared:WaitForChild("App"))
local Ui = require(Shared:WaitForChild("Ui"))
local Audio = require(Shared:WaitForChild("Audio"))
local Remotes = require(Shared:WaitForChild("Remotes"))
local Utils = require(Shared:WaitForChild("Utils"))

local player = Players.LocalPlayer

local TILE = 32
local VIEW_W, VIEW_H = 960, 540

local Play = {}
Play.__index = Play

function Play.build()
	local self = setmetatable({}, Play)
	local tok = Ui.tokens(App.state.theme)

	-- outer screen frame (fills viewport), centers a scaled stage
	local screen = Instance.new("Frame")
	screen.Name = "Play"
	screen.Size = UDim2.new(1, 0, 1, 0)
	screen.BackgroundColor3 = tok.bg
	screen.BorderSizePixel = 0
	screen.Visible = false
	screen.Parent = App.root
	self.screen = screen
	self.tok = tok

	-- top bar
	local topBar = Instance.new("Frame")
	topBar.Size = UDim2.new(1, -32, 0, 44)
	topBar.Position = UDim2.new(0, 16, 0, 10)
	topBar.BackgroundTransparency = 1
	topBar.Parent = screen
	local tl = Instance.new("UIListLayout"); tl.FillDirection = Enum.FillDirection.Horizontal; tl.VerticalAlignment = Enum.VerticalAlignment.Center; tl.Padding = UDim.new(0, 8); tl.Parent = topBar
	local tr = Instance.new("UIListLayout"); tr.FillDirection = Enum.FillDirection.Horizontal; tr.HorizontalAlignment = Enum.HorizontalAlignment.Right; tr.VerticalAlignment = Enum.VerticalAlignment.Center; tr.Padding = UDim.new(0, 8); tr.Parent = topBar

	self.quitBtn = Ui.pill({ parent = topBar, label = "← Quit", variant = "ghost", size = "sm", theme = App.state.theme, width = 100, order = 1, onClick = function() self:quit() end })
	self.levelChip, self.levelText = Ui.chip({ parent = topBar, text = "LV 01", theme = App.state.theme, order = 2, height = 34, textSize = 11 })

	local rightCluster = Instance.new("Frame")
	rightCluster.Size = UDim2.new(0, 10, 0, 34)
	rightCluster.AutomaticSize = Enum.AutomaticSize.X
	rightCluster.BackgroundTransparency = 1
	rightCluster.Parent = topBar
	local rcl = Instance.new("UIListLayout"); rcl.FillDirection = Enum.FillDirection.Horizontal; rcl.Padding = UDim.new(0, 8); rcl.Parent = rightCluster
	self.timeChip, self.timeText = Ui.chip({ parent = rightCluster, text = "00:00", theme = App.state.theme, height = 34, width = 90, textSize = 12 })
	self.timeChip.Size = UDim2.new(0, 90, 0, 34)
	self.deathsChip, self.deathsText = Ui.chip({ parent = rightCluster, text = "☠ 0", theme = App.state.theme, height = 34, textSize = 12 })
	self.coinsChip, self.coinsText = Ui.chip({ parent = rightCluster, text = "● 0", theme = App.state.theme, height = 34, textSize = 12 })
	self.pauseBtn = Ui.iconButton({ parent = rightCluster, name = "Pause", text = "❚❚", size = 34, theme = App.state.theme, onClick = function() self:togglePause() end })

	-- stage container (aspect-locked, centered)
	local stageWrap = Instance.new("Frame")
	stageWrap.Size = UDim2.new(1, -32, 1, -120)
	stageWrap.Position = UDim2.new(0, 16, 0, 60)
	stageWrap.BackgroundTransparency = 1
	stageWrap.Parent = screen
	local center = Instance.new("UIAspectRatioConstraint")
	center.AspectRatio = VIEW_W / VIEW_H
	center.AspectType = Enum.AspectType.ScaleWithParentSize
	center.DominantAxis = Enum.DominantAxis.Width
	center.Parent = stageWrap
	local align = Instance.new("UIListLayout")
	align.HorizontalAlignment = Enum.HorizontalAlignment.Center
	align.VerticalAlignment = Enum.VerticalAlignment.Center
	align.Parent = stageWrap

	local stage = Instance.new("Frame")
	stage.Name = "Stage"
	stage.Size = UDim2.new(0, VIEW_W, 0, VIEW_H)
	stage.BackgroundColor3 = tok.bg
	stage.BorderSizePixel = 0
	stage.ClipsDescendants = true
	stage.Parent = stageWrap
	self.stage = stage

	self.renderer = Renderer.new(stage)

	-- toast label (over canvas)
	self.toast = Instance.new("TextLabel")
	self.toast.Size = UDim2.new(0, 10, 0, 40)
	self.toast.AutomaticSize = Enum.AutomaticSize.X
	self.toast.Position = UDim2.new(0.5, 0, 0.12, 0)
	self.toast.AnchorPoint = Vector2.new(0.5, 0)
	self.toast.BackgroundColor3 = tok.fg
	self.toast.TextColor3 = tok.bg
	self.toast.FontFace = Ui.FONT_MONO_BOLD
	self.toast.TextSize = 15
	self.toast.Text = ""
	self.toast.Visible = false
	self.toast.BorderSizePixel = 0
	self.toast.Parent = stage
	Ui.corner(self.toast, 20)
	Ui.pad(self.toast, 24, 0, 24, 0)

	-- reversed indicator
	self.reversed = Instance.new("TextLabel")
	self.reversed.Size = UDim2.new(0, 10, 0, 32)
	self.reversed.AutomaticSize = Enum.AutomaticSize.X
	self.reversed.Position = UDim2.new(0, 16, 0, 12)
	self.reversed.BackgroundColor3 = tok.fg
	self.reversed.TextColor3 = tok.bg
	self.reversed.FontFace = Ui.FONT_MONO_BOLD
	self.reversed.TextSize = 11
	self.reversed.Text = "CONTROLS REVERSED"
	self.reversed.Visible = false
	self.reversed.BorderSizePixel = 0
	self.reversed.Parent = stage
	Ui.corner(self.reversed, 16)
	Ui.pad(self.reversed, 16, 0, 16, 0)

	-- gear chips (bottom-right)
	local gear = Instance.new("Frame")
	gear.Size = UDim2.new(0, 10, 0, 36)
	gear.AutomaticSize = Enum.AutomaticSize.X
	gear.Position = UDim2.new(1, -12, 1, -12)
	gear.AnchorPoint = Vector2.new(1, 1)
	gear.BackgroundTransparency = 1
	gear.Parent = stage
	local gl = Instance.new("UIListLayout"); gl.FillDirection = Enum.FillDirection.Horizontal; gl.Padding = UDim.new(0, 8); gl.Parent = gear
	self.scopeBtn = self:gearChip(gear, "✛", "SCOPE", "gear:reveal", function() self:useReveal() end)
	self.anchorBtn = self:gearChip(gear, "⚑", "ANCHOR", "gear:pass", function() self:useAnchor() end)

	-- controls hint
	local hint = Instance.new("TextLabel")
	hint.Size = UDim2.new(0, 10, 0, 16)
	hint.AutomaticSize = Enum.AutomaticSize.X
	hint.Position = UDim2.new(0, 16, 1, -34)
	hint.BackgroundTransparency = 1
	hint.Text = "WASD/ARROWS MOVE · SPACE JUMP · R RESTART · 1 SCOPE · 2 ANCHOR · ESC PAUSE"
	hint.TextColor3 = tok.mut
	hint.FontFace = Ui.FONT_MONO
	hint.TextSize = 10
	hint.TextXAlignment = Enum.TextXAlignment.Left
	hint.Parent = stage

	-- touch controls
	self.touch = Instance.new("Frame")
	self.touch.Size = UDim2.new(1, -24, 0, 72)
	self.touch.Position = UDim2.new(0, 12, 1, -84)
	self.touch.BackgroundTransparency = 1
	self.touch.Visible = false
	self.touch.Parent = stage
	self:buildTouch(self.touch)

	-- overlays
	self.intro = self:buildIntro()
	self.pauseOv = self:buildPause()
	self.winOv = self:buildWin()

	-- bottom strip
	local bottom = Instance.new("Frame")
	bottom.Size = UDim2.new(1, -32, 0, 24)
	bottom.Position = UDim2.new(0, 16, 1, -30)
	bottom.BackgroundTransparency = 1
	bottom.Parent = screen
	self.parLabel = Ui.label({ parent = bottom, text = "", color = tok.mut, font = Ui.FONT_MONO, textSize = 11, size = UDim2.new(1, -200, 1, 0), xAlign = Enum.TextXAlignment.Left })
	local chipHolder = Instance.new("Frame")
	chipHolder.Size = UDim2.new(0, 10, 0, 24)
	chipHolder.AutomaticSize = Enum.AutomaticSize.X
	chipHolder.Position = UDim2.new(1, 0, 0, 0)
	chipHolder.AnchorPoint = Vector2.new(1, 0)
	chipHolder.BackgroundTransparency = 1
	bottom.Parent = screen
	chipHolder.Parent = bottom
	Ui.label({ parent = chipHolder, text = "", color = tok.mut, font = Ui.FONT_MONO_BOLD, textSize = 11, size = UDim2.new(0, 0, 1, 0), automatic = Enum.AutomaticSize.X, name = "Coins", xAlign = Enum.TextXAlignment.Right })

	-- state
	self.eng = nil
	self.levelId = 1
	self.running = false
	self.submitted = false
	self.winInfo = nil
	self.paused = false
	self.introOn = true
	self.lastTs = os.clock()
	self.hudConn = nil
	self.inputConn = {}
	self.toastTimer = nil

	self:bindInput()
	return self
end

function Play:gearChip(parent, glyph, label, itemId, onClick)
	local tok = Ui.tokens(App.state.theme)
	local b = Instance.new("TextButton")
	b.AutoButtonColor = false
	b.Size = UDim2.new(0, 10, 0, 34)
	b.AutomaticSize = Enum.AutomaticSize.X
	b.BackgroundColor3 = Color3.fromHex(App.state.theme == "dark" and "0b0b0c" or "f1f1ee")
	b.BackgroundTransparency = 0.15
	b.TextColor3 = tok.fg
	b.FontFace = Ui.FONT_MONO_BOLD
	b.TextSize = 10
	b.BorderSizePixel = 0
	Ui.corner(b, 18)
	Ui.pad(b, 14, 0, 14, 0)
	b.Parent = parent
	self:refreshGearLabel(b, glyph, label, itemId)
	b.MouseButton1Click:Connect(function()
		Audio.sfx.click()
		onClick()
	end)
	return b
end

function Play:refreshGearLabel(button, glyph, label, itemId)
	button.Text = string.format("%s  %s ×%d", glyph, label, App.ownedQty(itemId))
end

function Play:buildTouch(parent)
	local function roundBtn(text, wide)
		local b = Instance.new("TextButton")
		b.AutoButtonColor = false
		b.Size = if wide then UDim2.new(0, 120, 0, 64) else UDim2.new(0, 64, 0, 64)
		b.BackgroundColor3 = Color3.fromHex(App.state.theme == "dark" and "0b0b0c" or "f1f1ee")
		b.BackgroundTransparency = 0.3
		b.TextColor3 = Ui.tokens(App.state.theme).fg
		b.Text = text
		b.FontFace = Ui.FONT_MONO_BOLD
		b.TextSize = if wide then 14 else 26
		b.BorderSizePixel = 0
		Ui.corner(b, 32)
		b.Parent = parent
		return b
	end
	local left = roundBtn("‹")
	left.Position = UDim2.new(0, 0, 0.5, -32)
	local right = roundBtn("›")
	right.Position = UDim2.new(0, 72, 0.5, -32)
	local jump = roundBtn("JUMP", true)
	jump.Position = UDim2.new(1, -120, 0.5, -32)

	local function bindHold(b, code)
		b.MouseButton1Down:Connect(function() self:press(code, true) end)
		b.MouseButton1Up:Connect(function() self:press(code, false) end)
		b.MouseLeave:Connect(function() self:press(code, false) end)
	end
	bindHold(left, "ArrowLeft")
	bindHold(right, "ArrowRight")
	bindHold(jump, "Space")
end

function Play:buildIntro()
	local tok = Ui.tokens(App.state.theme)
	local ov = Instance.new("Frame")
	ov.Size = UDim2.new(1, 0, 1, 0)
	ov.BackgroundColor3 = tok.bg
	ov.BackgroundTransparency = 0.05
	ov.ZIndex = 20
	ov.Visible = false
	ov.Parent = self.stage
	local col = Instance.new("UIListLayout"); col.VerticalAlignment = Enum.VerticalAlignment.Center; col.HorizontalAlignment = Enum.HorizontalAlignment.Center; col.Padding = UDim.new(0, 8); col.Parent = ov
	self.introLevel = Ui.label({ parent = ov, text = "LEVEL 01", color = tok.mut, font = Ui.FONT_MONO, textSize = 12, xAlign = Enum.TextXAlignment.Center, size = UDim2.new(1, 0, 0, 16), order = 1 })
	self.introLevel.TextXAlignment = Enum.TextXAlignment.Center
	self.introName = Ui.label({ parent = ov, text = "", color = tok.fg, font = Ui.FONT_HEAD, textSize = 42, xAlign = Enum.TextXAlignment.Center, size = UDim2.new(1, 0, 0, 52), order = 2 })
	self.introName.TextXAlignment = Enum.TextXAlignment.Center
	self.introTip = Ui.label({ parent = ov, text = "", color = tok.mut, font = Ui.FONT_MONO, textSize = 12, xAlign = Enum.TextXAlignment.Center, size = UDim2.new(1, -40, 0, 20), order = 3 })
	self.introTip.TextXAlignment = Enum.TextXAlignment.Center
	local ready = Ui.label({ parent = ov, text = "GET READY", color = tok.fg, font = Ui.FONT_MONO_BOLD, textSize = 11, xAlign = Enum.TextXAlignment.Center, size = UDim2.new(1, 0, 0, 18), order = 4 })
	ready.TextXAlignment = Enum.TextXAlignment.Center
	return ov
end

function Play:buildPause()
	local tok = Ui.tokens(App.state.theme)
	local ov = Instance.new("Frame")
	ov.Size = UDim2.new(1, 0, 1, 0)
	ov.BackgroundColor3 = tok.bg
	ov.BackgroundTransparency = 0.1
	ov.ZIndex = 20
	ov.Visible = false
	ov.Parent = self.stage
	local col = Instance.new("UIListLayout"); col.VerticalAlignment = Enum.VerticalAlignment.Center; col.HorizontalAlignment = Enum.HorizontalAlignment.Center; col.Padding = UDim.new(0, 10); col.Parent = ov
	local h = Ui.label({ parent = ov, text = "PAUSED.", color = tok.fg, font = Ui.FONT_HEAD, textSize = 48, size = UDim2.new(1, 0, 0, 60), order = 1 })
	h.TextXAlignment = Enum.TextXAlignment.Center
	local s = Ui.label({ parent = ov, text = "THE SPIKES ARE RESTING. ENJOY IT.", color = tok.mut, font = Ui.FONT_MONO, textSize = 12, size = UDim2.new(1, 0, 0, 18), order = 2 })
	s.TextXAlignment = Enum.TextXAlignment.Center

	local row = Instance.new("Frame"); row.AutomaticSize = Enum.AutomaticSize.X; row.Size = UDim2.new(0, 0, 0, 46); row.BackgroundTransparency = 1; row.LayoutOrder = 3; row.Parent = ov
	local rl = Instance.new("UIListLayout"); rl.FillDirection = Enum.FillDirection.Horizontal; rl.Padding = UDim.new(0, 10); rl.Parent = row
	Ui.pill({ parent = row, label = "▶ Resume", variant = "solid", theme = App.state.theme, onClick = function() self:togglePause() end })
	Ui.pill({ parent = row, label = "↻ Restart", variant = "soft", theme = App.state.theme, onClick = function() self:restart() end })
	Ui.pill({ parent = row, label = "← Quit", variant = "ghost", theme = App.state.theme, onClick = function() self:quit() end })
	return ov
end

function Play:buildWin()
	local tok = Ui.tokens(App.state.theme)
	local ov = Instance.new("Frame")
	ov.Size = UDim2.new(1, 0, 1, 0)
	ov.BackgroundColor3 = tok.bg
	ov.BackgroundTransparency = 0.05
	ov.ZIndex = 20
	ov.Visible = false
	ov.Parent = self.stage
	local col = Instance.new("UIListLayout"); col.VerticalAlignment = Enum.VerticalAlignment.Center; col.HorizontalAlignment = Enum.HorizontalAlignment.Center; col.Padding = UDim.new(0, 10); col.Parent = ov
	self.winKicker = Ui.label({ parent = ov, text = "IMPOSSIBLE. YOU ACTUALLY DID IT.", color = tok.mut, font = Ui.FONT_MONO, textSize = 12, size = UDim2.new(1, 0, 0, 16), order = 1 })
	self.winKicker.TextXAlignment = Enum.TextXAlignment.Center
	self.winTitle = Ui.label({ parent = ov, text = "LEVEL CLEARED", color = tok.fg, font = Ui.FONT_HEAD, textSize = 46, size = UDim2.new(1, 0, 0, 56), order = 2 })
	self.winTitle.TextXAlignment = Enum.TextXAlignment.Center

	self.winStats = Instance.new("Frame")
	self.winStats.AutomaticSize = Enum.AutomaticSize.Y
	self.winStats.Size = UDim2.new(0, 0, 0, 40)
	self.winStats.BackgroundTransparency = 1
	self.winStats.LayoutOrder = 3
	self.winStats.Parent = ov
	local sl = Instance.new("UIListLayout"); sl.FillDirection = Enum.FillDirection.Horizontal; sl.HorizontalAlignment = Enum.HorizontalAlignment.Center; sl.Padding = UDim.new(0, 8); sl.Parent = self.winStats

	local row = Instance.new("Frame"); row.AutomaticSize = Enum.AutomaticSize.X; row.Size = UDim2.new(0, 0, 0, 46); row.BackgroundTransparency = 1; row.LayoutOrder = 4; row.Parent = ov
	local rl = Instance.new("UIListLayout"); rl.FillDirection = Enum.FillDirection.Horizontal; rl.Padding = UDim.new(0, 10); rl.Parent = row
	self.nextBtn = Ui.pill({ parent = row, label = "⚑ Next Level", variant = "solid", theme = App.state.theme, onClick = function()
		if self.winInfo and self.winInfo.nextId then self:startLevel(self.winInfo.nextId) end
	end })
	Ui.pill({ parent = row, label = "↻ Replay", variant = "soft", theme = App.state.theme, onClick = function() self:restart() end })
	Ui.pill({ parent = row, label = "← Levels", variant = "ghost", theme = App.state.theme, onClick = function() self:quit() end })
	return ov
end

-- ——— input ———
function Play:press(code, down)
	if self.eng then self.eng:press(code, down) end
end

function Play:bindInput()
	self.inputConnBegan = UserInputService.InputBegan:Connect(function(input, gp)
		if gp and input.UserInputType ~= Enum.UserInputType.Keyboard then return end
		self:handleKey(input.KeyCode, true)
	end)
	self.inputConnEnded = UserInputService.InputEnded:Connect(function(input, gp)
		if gp and input.UserInputType ~= Enum.UserInputType.Keyboard then return end
		self:handleKey(input.KeyCode, false)
	end)
end

function Play:handleKey(key, down)
	if not self.running or not self.eng then return end
	if key == Enum.KeyCode.Left or key == Enum.KeyCode.A then self:press("ArrowLeft", down)
	elseif key == Enum.KeyCode.Right or key == Enum.KeyCode.D then self:press("ArrowRight", down)
	elseif key == Enum.KeyCode.Space or key == Enum.KeyCode.Up or key == Enum.KeyCode.W then self:press("Space", down)
	elseif down and key == Enum.KeyCode.R then self:restart()
	elseif down and (key == Enum.KeyCode.Escape or key == Enum.KeyCode.P) then self:togglePause()
	elseif down and key == Enum.KeyCode.One then self:useReveal()
	elseif down and key == Enum.KeyCode.Two then self:useAnchor()
	end
end

-- ——— lifecycle ———
function Play:onEnter(levelId)
	levelId = tonumber(levelId) or self.levelId or 1
	local unlocked = App.state.unlockedLevel or 1
	if not Levels.getLevel(levelId) or levelId > unlocked then
		App.navigate("Locked", levelId)
		return
	end
	self:startLevel(levelId)
end

function Play:onExit()
	self:teardown()
end

function Play:startLevel(levelId)
	self:teardown()
	self.levelId = levelId
	local L = Levels.getLevel(levelId)
	local meta = nil
	for _, m in ipairs(Catalog.LEVEL_META) do if m.id == levelId then meta = m end end
	self.meta = meta

	local settings = App.state.settings or {}
	self.eng = Engine.new(L, App.palette(), {
		onDeath = function(info) self:onDeath(info) end,
		onWin = function(stats) self:onWin(stats) end,
		onToast = function(text) self:showToast(text) end,
	}, {
		viewW = VIEW_W, viewH = VIEW_H,
		skin = self:okCosmetic(settings.skin, "skin:solid"),
		trail = self:okCosmetic(settings.trail, "trail:none"),
		tauntKey = (self:okCosmetic(settings.taunt, "taunt:classic")):gsub("taunt:", ""),
		shakeEnabled = if settings.shake ~= nil then settings.shake else true,
	})
	self.eng:start()

	self.levelText.Text = string.format("LV %02d — %s", levelId, L.name)
	self.parLabel.Text = if meta then string.format("PAR %ds · DEATHLESS +%d · SPEED +%d", meta.par, meta.deathlessBonus, Catalog.SPEED_BONUS) else ""

	-- intro
	self.introLevel.Text = string.format("LEVEL %02d", levelId)
	self.introName.Text = L.name
	self.introTip.Text = L.tip
	self.intro.Visible = true
	self.introOn = true
	task.delay(2.1, function()
		if self.eng and self.levelId == levelId then
			self.intro.Visible = false
			self.introOn = false
		end
	end)

	self.winOv.Visible = false
	self.pauseOv.Visible = false
	self.winInfo = nil
	self.paused = false
	self.submitted = false
	self.running = true
	self.lastTs = os.clock()
	self:updateHud()

	Audio.sfx.levelStart()

	-- hud ticker
	self.hudConn = RunService.Heartbeat:Connect(function(dt) self:tick(dt) end)

	-- enable touch on coarse pointers
	self.touch.Visible = UserInputService.TouchEnabled and not UserInputService.KeyboardEnabled
end

function Play:okCosmetic(id, fallback)
	if not id then return fallback end
	local qty = App.ownedQty(id)
	if qty > 0 or id:sub(-5) == ":solid" or id:sub(-4) == ":none" or id:sub(-7) == ":classic" then
		return id
	end
	return fallback
end

function Play:teardown()
	self.running = false
	if self.hudConn then self.hudConn:Disconnect(); self.hudConn = nil end
	if self.eng then
		local d = self.eng.deaths
		self.eng:destroy()
		if not self.submitted and d > 0 then
			self:submitRun(false, d, 0, 0)
		end
		self.eng = nil
	end
end

function Play:tick(dt)
	if not self.running or not self.eng then return end
	local eng = self.eng
	if not eng.paused then
		eng.acc += math.min(0.05, dt)
		local steps = 0
		while eng.acc >= 1 / 60 and steps < 3 do
			eng:step(1 / 60)
			eng.acc -= 1 / 60
			steps += 1
		end
		if steps == 3 then eng.acc = 0 end
	end
	self.renderer:render(eng, eng.pal, dt)

	-- HUD
	self.reversed.Visible = eng:hud().reversed
	if eng.clock < eng.toastUntil and eng.toastText ~= "" then
		self.toast.Visible = true
		self.toast.Text = eng.toastText
		self.toast.TextTransparency = 0
	else
		self.toast.Visible = false
	end
	self:updateHud()
end

function Play:updateHud()
	if not self.eng then return end
	local h = self.eng:hud()
	self.timeText.Text = Utils.fmtClock(h.timeMs)
	self.deathsText.Text = string.format("☠ %d", h.deaths)
	self.coinsText.Text = string.format("● %d", h.coins)
end

function Play:showToast(text)
	self.toast.Text = text
	self.toast.Visible = true
	if self.toastTimer then task.cancel(self.toastTimer) end
	self.toastTimer = task.delay(2.3, function()
		-- engine's own toastUntil may still be showing; only hide if engine done
		if not self.eng or self.eng.clock >= self.eng.toastUntil then
			self.toast.Visible = false
		end
	end)
end

function Play:onDeath(info)
	self.deathsText.Text = string.format("☠ %d", info.count)
end

function Play:onWin(stats)
	if self.submitted then return end
	self:submitRun(true, stats.deaths, stats.timeMs, stats.coins, stats)
end

function Play:submitRun(won, deaths, timeMs, coins, stats)
	if self.submitted then return end
	self.submitted = true
	task.spawn(function()
		local ok, res = pcall(function()
			return Remotes.SubmitRun:InvokeServer({
				levelId = self.levelId, won = won, runDeaths = deaths, timeMs = timeMs, coins = coins,
			})
		end)
		if ok and res then
			if App.state.profile and res.profile then App.state.profile = res.profile end
			if res.unlockedLevel then App.state.unlockedLevel = res.unlockedLevel end
			if res.newAchievements and #res.newAchievements > 0 then
				for _, key in ipairs(res.newAchievements) do
					local def = nil
					for _, a in ipairs(Catalog.ACHIEVEMENTS) do if a.key == key then def = a end end
					if def then
						App.notify("ACHIEVEMENT · " .. def.name, def.desc, "success")
						Audio.sfx.achievement()
					end
				end
			end
			if won then
				self:showWin(stats or { timeMs = timeMs, deaths = deaths, coins = coins }, res)
			end
		else
			self.submitted = false
			App.notify("SYNC FAILED", "YOUR PAIN WAS NOT RECORDED", "error")
		end
	end)
end

function Play:showWin(stats, res)
	self.winInfo = { stats = stats, coinsEarned = res.coinsEarned, firstClear = res.firstClear, nextId = self.levelId + 1 }
	self.winStats:ClearAllChildren()
	local tok = Ui.tokens(App.state.theme)
	local sl = Instance.new("UIListLayout"); sl.FillDirection = Enum.FillDirection.Horizontal; sl.HorizontalAlignment = Enum.HorizontalAlignment.Center; sl.Padding = UDim.new(0, 8); sl.Parent = self.winStats
	Ui.chip({ parent = self.winStats, text = "TIME " .. Utils.fmtTime(stats.timeMs), theme = App.state.theme, height = 40, textSize = 12, order = 1 })
	Ui.chip({ parent = self.winStats, text = string.format("☠ %d DEATHS", stats.deaths), theme = App.state.theme, height = 40, textSize = 12, order = 2 })
	Ui.chip({ parent = self.winStats, text = string.format("● +%d", res.coinsEarned), theme = App.state.theme, height = 40, textSize = 12, solid = true, order = 3 })
	if res.firstClear then
		Ui.chip({ parent = self.winStats, text = "FIRST CLEAR", theme = App.state.theme, height = 40, textSize = 12, order = 4 })
	end
	self.winOv.Visible = true
end

function Play:restart()
	if not self.eng then return end
	Audio.sfx.restart()
	local d = self.eng.deaths
	local alreadyBanked = self.eng.won
	self.winOv.Visible = false
	self.pauseOv.Visible = false
	self.winInfo = nil
	self.paused = false
	self.eng.paused = false
	self.submitted = false
	self.eng:rebuild(false)
	self.running = true
	self:updateHud()
	if d > 0 and not alreadyBanked then
		self:submitRun(false, d, 0, 0)
		self.submitted = false
	end
end

function Play:togglePause()
	local eng = self.eng
	if not eng or eng.won then return end
	eng.paused = not eng.paused
	self.paused = eng.paused
	if eng.paused then
		Audio.sfx.pause()
		self.pauseOv.Visible = true
	else
		Audio.sfx.resume()
		self.pauseOv.Visible = false
	end
end

function Play:useReveal()
	local eng = self.eng
	if not eng or eng.won then return end
	if App.ownedQty("gear:reveal") <= 0 then
		App.notify("NO TRAP-SCOPE", "THE SHOP SELLS MORE", "error")
		return
	end
	task.spawn(function()
		local ok = pcall(function() return Remotes.UseItem:InvokeServer({ itemId = "gear:reveal" }) end)
		if ok then
			eng:useReveal()
			App.state.owned["gear:reveal"] = math.max(0, App.ownedQty("gear:reveal") - 1)
			self:refreshGearLabel(self.scopeBtn, "✛", "SCOPE", "gear:reveal")
		else
			App.notify("NO TRAP-SCOPE", "THE SHOP SELLS MORE", "error")
		end
	end)
end

function Play:useAnchor()
	local eng = self.eng
	if not eng or eng.won then return end
	if App.ownedQty("gear:pass") <= 0 then
		App.notify("NO ANCHOR", "THE SHOP SELLS MORE", "error")
		return
	end
	if not eng:placeCheckpoint() then
		Audio.sfx.denied()
		return
	end
	task.spawn(function()
		local ok = pcall(function() return Remotes.UseItem:InvokeServer({ itemId = "gear:pass" }) end)
		if ok then
			App.state.owned["gear:pass"] = math.max(0, App.ownedQty("gear:pass") - 1)
			self:refreshGearLabel(self.anchorBtn, "⚑", "ANCHOR", "gear:pass")
		end
	end)
end

function Play:quit()
	self:teardown()
	App.navigate("Levels")
end

return Play
