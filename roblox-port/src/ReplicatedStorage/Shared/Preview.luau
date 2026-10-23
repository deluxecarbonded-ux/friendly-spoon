--!strict
-- EXOTIC live previews — a port of src/game/preview.ts. A bot genuinely plays
-- real levels and shop-demo scenes with the same Engine, physics and traps.
-- Instead of a canvas each preview owns a small Renderer bound to a Frame.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Engine = require(Shared:WaitForChild("Engine"))
local Renderer = require(Shared:WaitForChild("Renderer"))
local Levels = require(Shared:WaitForChild("Levels"))
local TILE = Engine.TILE

local function R(ch, n) return string.rep(ch, n) end

local function grid(W, H, pieces)
	local g = {}
	for r = 1, H do
		g[r] = {}
		for c = 1, W do g[r][c] = " " end
	end
	for _, p in ipairs(pieces) do
		local r, c, s = p[1] + 1, p[2] + 1, p[3]
		for i = 1, #s do
			if r >= 1 and r <= H and c + i - 1 >= 1 and c + i - 1 <= W then
				g[r][c + i - 1] = s:sub(i, i)
			end
		end
	end
	local rows = {}
	for r = 1, H do rows[r] = table.concat(g[r]) end
	return rows
end

export type BotConfig = {
	lemming: boolean?,
	clumsy: boolean?,
	wrapAtCol: number?,
	script: ((eng: any, dt: number) -> ())?,
}

local function makeBot(cfg: BotConfig)
	local jumpHold = 0
	local jumpPressed = false
	local idleMs = 0
	local lastX = -1
	return function(eng, dt)
		eng.input.left = false
		eng.input.right = true

		if not cfg.lemming then
			local supportRow = if eng.gravSign == 1
				then math.floor((eng.py + eng.ph + 4) / TILE)
				else math.floor((eng.py - 4) / TILE)
			local midRow = math.floor((eng.py + eng.ph / 2) / TILE)
			local ahead = math.floor((eng.px + eng.pw + 10) / TILE)
			local wall = eng:solidAt(ahead, midRow)
			local noFloor = not eng:solidAt(ahead, supportRow) and not eng:hazardAt(ahead, supportRow)
			local spike = eng:hazardAt(ahead, supportRow)
				or eng:hazardAt(ahead + 1, supportRow - (if eng.gravSign == 1 then 1 else -1))
			local guard = eng:guardInFront(3)
			if jumpHold > 0 then
				eng.input.jumpHeld = true
				if not jumpPressed then
					eng:press("Space", true)
					jumpPressed = true
				end
				jumpHold -= dt
			else
				eng.input.jumpHeld = false
				if jumpPressed then
					eng:press("Space", false)
					jumpPressed = false
				end
				if eng.grounded and (wall or noFloor or spike or guard) then
					if cfg.clumsy and math.random() < 0.35 then
						jumpHold = 0
					else
						jumpHold = 0.15 + math.random() * 0.06
						eng.input.jumpHeld = true
						eng:press("Space", true)
						jumpPressed = true
					end
				end
			end
		else
			eng.input.jumpHeld = false
		end

		if cfg.script then cfg.script(eng, dt) end

		if cfg.wrapAtCol and eng.px > cfg.wrapAtCol * TILE then
			eng:rebuild(true)
			lastX = -1
			idleMs = 0
			return
		end
		if lastX >= 0 and math.abs(eng.px - lastX) < 1.5 then
			idleMs += dt * 1000
		else
			idleMs = 0
		end
		lastX = eng.px
		if idleMs > 2800 then
			eng:rebuild(true)
			idleMs = 0
			lastX = -1
		end
	end
end

local function skinScene()
	local level = {
		id = 101, name = "SKIN DEMO", tip = "", par = 0, W = 30, H = 8,
		rows = grid(30, 8, {
			{ 4, 0, R("#", 30) }, { 5, 0, R("#", 30) },
			{ 3, 2, "S" },
			{ 3, 9, "#" },
			{ 2, 14, "C" },
			{ 3, 19, "^" },
			{ 2, 24, "CC" },
		}),
		events = {},
	}
	return { level = level, cfg = { wrapAtCol = 27 } :: BotConfig }
end

local function revealScene()
	local level = {
		id = 102, name = "TRAP-SCOPE DEMO", tip = "", par = 0, W = 30, H = 8,
		rows = grid(30, 8, {
			{ 4, 0, R("#", 30) }, { 5, 0, R("#", 30) },
			{ 3, 2, "S" },
			{ 2, 10, "HH" },
			{ 4, 14, "DDDD" }, { 5, 14, "    " },
			{ 3, 19, "F" },
			{ 3, 23, "^" },
		}),
		events = {},
	}
	local flash = 0
	return {
		level = level,
		cfg = {
			wrapAtCol = 27,
			script = function(eng)
				if eng.runMs > flash + 2600 then
					flash = eng.runMs
					eng:revealFlash(1400)
				end
			end,
		} :: BotConfig,
	}
end

local function passScene()
	local level = {
		id = 103, name = "ANCHOR DEMO", tip = "", par = 0, W = 30, H = 8,
		rows = grid(30, 8, {
			{ 4, 0, R("#", 30) }, { 5, 0, R("#", 30) },
			{ 3, 2, "S" },
			{ 3, 13, "^" },
			{ 3, 17, "^" },
			{ 3, 21, "^" },
		}),
		events = {},
	}
	local dropped = false
	return {
		level = level,
		cfg = {
			clumsy = true,
			wrapAtCol = 27,
			script = function(eng)
				if not dropped and eng.grounded and eng.px > 11 * TILE then
					eng:placeCheckpoint()
					dropped = true
				end
				if eng.px < 2 * TILE then dropped = false end
			end,
		} :: BotConfig,
	}
end

local function skipScene()
	local level = {
		id = 104, name = "SKIP DEMO", tip = "", par = 0, W = 34, H = 8,
		rows = grid(34, 8, {
			{ 4, 0, R("#", 34) }, { 5, 0, R("#", 34) },
			{ 3, 2, "S" },
			{ 2, 9, "CCC" },
			{ 2, 17, "CC" },
			{ 3, 28, "G" },
		}),
		events = {
			{ type = "goalshift", x = 22, y = 0, w = 4, h = 8, dx = -9, once = true, text = "NOPE." },
		},
	}
	return { level = level, cfg = { wrapAtCol = 31 } :: BotConfig }
end

local function tauntScene()
	local level = {
		id = 105, name = "TAUNT DEMO", tip = "", par = 0, W = 22, H = 8,
		rows = grid(22, 8, {
			{ 4, 0, R("#", 22) }, { 5, 0, R("#", 22) },
			{ 3, 2, "S" },
			{ 3, 12, "^" },
			{ 3, 18, "^" },
		}),
		events = {},
	}
	return { level = level, cfg = { lemming = true } :: BotConfig }
end

export type PreviewSpec = {
	level: any,
	cfg: BotConfig,
	engineSkin: string?,
	engineTrail: string?,
	tauntKey: string?,
}

local Preview = {}

function Preview.previewSpecFor(itemId: string): PreviewSpec?
	if itemId:sub(1, 5) == "skin:" then
		local s = skinScene()
		return { level = s.level, cfg = s.cfg, engineSkin = itemId }
	end
	if itemId:sub(1, 6) == "trail:" then
		local s = skinScene()
		return { level = s.level, cfg = s.cfg, engineTrail = itemId }
	end
	if itemId == "gear:reveal" then
		local s = revealScene()
		return { level = s.level, cfg = s.cfg }
	end
	if itemId == "gear:pass" then
		local s = passScene()
		return { level = s.level, cfg = s.cfg }
	end
	if itemId == "gear:skip" then
		local s = skipScene()
		return { level = s.level, cfg = s.cfg }
	end
	if itemId:sub(1, 6) == "taunt:" then
		local s = tauntScene()
		return { level = s.level, cfg = s.cfg, tauntKey = itemId:gsub("taunt:", "") }
	end
	return nil
end

function Preview.levelPreviewSpec(levelId: number): PreviewSpec?
	local level = Levels.getLevel(levelId)
	if not level then return nil end
	return { level = level, cfg = { wrapAtCol = math.max(24, level.W - 3) } :: BotConfig }
end

-- A running preview bound to a container Frame.
local PreviewPlayer = {}
PreviewPlayer.__index = PreviewPlayer

function PreviewPlayer.new(parent: Frame, spec: PreviewSpec, theme: string, viewW: number?, viewH: number?)
	local self = setmetatable({}, PreviewPlayer)
	local w = viewW or math.floor(parent.AbsoluteSize.X) or 384
	local h = viewH or math.floor(parent.AbsoluteSize.Y) or 216
	local stage = Instance.new("Frame")
	stage.Size = UDim2.new(1, 0, 1, 0)
	stage.BackgroundColor3 = Color3.fromHex("0b0b0c")
	stage.BorderSizePixel = 0
	stage.ClipsDescendants = true
	stage.Parent = parent
	self.stage = stage

	local pal = require(Shared:WaitForChild("Catalog")).PALETTE[theme] or require(Shared:WaitForChild("Catalog")).PALETTE.dark
	self.engine = Engine.new(spec.level, pal, {}, {
		viewW = w, viewH = h, silent = true, drawToastsOnCanvas = true,
		skin = spec.engineSkin, trail = spec.engineTrail, tauntKey = spec.tauntKey,
		controller = makeBot(spec.cfg),
	})
	self.renderer = Renderer.new(stage)
	self.running = true
	self.conn = game:GetService("RunService").Heartbeat:Connect(function(dt)
		if not self.running then return end
		local e = self.engine
		e.acc += math.min(0.05, dt)
		local steps = 0
		while e.acc >= 1 / 60 and steps < 3 do
			e:step(1 / 60)
			e.acc -= 1 / 60
			steps += 1
		end
		if steps == 3 then e.acc = 0 end
		self.renderer:render(e, e.pal, dt)
	end)
	return self
end

function PreviewPlayer:setPalette(theme: string)
	local pal = require(Shared:WaitForChild("Catalog")).PALETTE[theme]
	if pal then self.engine:setPalette(pal) end
end

function PreviewPlayer:destroy()
	self.running = false
	if self.conn then self.conn:Disconnect() end
	self.engine:destroy()
	self.stage:Destroy()
end

return {
	Preview = Preview,
	PreviewPlayer = PreviewPlayer,
	makeBot = makeBot,
}
