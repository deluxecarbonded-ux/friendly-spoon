--!strict
-- EXOTIC engine — a faithful 1:1 port of src/game/engine.ts (simulation only).
-- Rendering lives in Renderer.luau; input arrives through press()/input.
--
-- Tile coordinates are kept 0-indexed inside the simulation, exactly like the
-- TypeScript source, so every formula below matches the web build line-for-line.
-- The 1-indexed Luau grid is only touched through charAtGrid().

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Catalog = require(Shared:WaitForChild("Catalog"))
local Audio = require(Shared:WaitForChild("Audio"))
local TAUNTS = Catalog.TAUNTS
local FAKE_FLAG_MESSAGE = Catalog.FAKE_FLAG_MESSAGE
local FAKE_CHECKPOINT_MESSAGE = Catalog.FAKE_CHECKPOINT_MESSAGE

export type Palette = {
	bg: string,
	tile: string,
	player: string,
	accent: string,
	subtle: string,
	far: string,
	text: string,
}

export type EngineCallbacks = {
	onDeath: ((info: { count: number, message: string }) -> ())?,
	onWin: ((stats: { timeMs: number, deaths: number, coins: number }) -> ())?,
	onToast: ((text: string) -> ())?,
	onCoin: ((total: number) -> ())?,
	onCheckpoint: (() -> ())?,
}

export type EngineOptions = {
	viewW: number?,
	viewH: number?,
	silent: boolean?,
	drawToastsOnCanvas: boolean?,
	shakeEnabled: boolean?,
	keyboard: boolean?,
	skin: string?,
	trail: string?,
	tauntKey: string?,
	controller: ((eng: any, dt: number) -> ())?,
}

local Engine = {}
Engine.__index = Engine
Engine.TILE = 32

local GRAV = 2100
local MAX_FALL = 1500
local JUMP_VEL = 660
local SPRING_VEL = 900
local RUN_ACCEL = 3400
local AIR_ACCEL = 2300
local FRICTION = 3000
local MAX_RUN = 305
local COYOTE = 0.09
local BUFFER = 0.12

local LEFT_CODES = { "ArrowLeft", "KeyA" }
local RIGHT_CODES = { "ArrowRight", "KeyD" }
local JUMP_CODES = { "Space", "ArrowUp", "KeyW" }
local ALL_INPUT_CODES = { "ArrowLeft", "KeyA", "ArrowRight", "KeyD", "Space", "ArrowUp", "KeyW", "ArrowDown", "KeyS" }

local function seededRand(seed: number)
	local s = seed % 2 ^ 32
	return function()
		s = (s * 1664525 + 1013904223) % 2 ^ 32
		return s / 4294967296
	end
end

local function sign(x: number): number
	return if x > 0 then 1 elseif x < 0 then -1 else 0
end

local function nowMs(): number
	return os.clock() * 1000
end

local function makeSet()
	local t = {}
	return {
		has = function(_, k) return t[k] == true end,
		add = function(_, k) t[k] = true end,
		clear = function() table.clear(t) end,
		_raw = t,
	}
end

function Engine.new(level: any, palette: Palette, cb: EngineCallbacks?, opts: EngineOptions?)
	local self = setmetatable({}, Engine) :: any
	self.level = level
	self.pal = palette
	self.cb = cb or {}
	self.opts = opts or {}
	self.input = { left = false, right = false, jumpHeld = false }

	self.px = 0; self.py = 0; self.pw = 22; self.ph = 26
	self.vx = 0; self.vy = 0
	self.gravSign = 1
	self.grounded = false; self.dead = false; self.won = false
	self.paused = false; self.started = false
	self.deaths = 0; self.coins = 0; self.runMs = 0
	self.levelW = level.W * Engine.TILE
	self.levelH = level.H * Engine.TILE

	self.skin = (self.opts :: any).skin or "skin:solid"
	self.trail = (self.opts :: any).trail or "trail:none"
	self.tauntKey = (self.opts :: any).tauntKey or "classic"
	self.viewW = (self.opts :: any).viewW or 960
	self.viewH = (self.opts :: any).viewH or 540

	self.grid = {} :: { { string } }
	self.spawn = { x = 0, y = 0 }
	self.respawn = { x = 0, y = 0 }
	self.goal = { col = 0, row = 0, x = 0, y = 0 }
	self.goalDrawX = 0
	self.checkpoints = {}
	self.placedFlag = nil :: any
	self.coinMap = {} :: any
	self.dMap = {} :: any
	self.pMap = {} :: any
	self.guards = {}
	self.buttons = {}
	self.drones = {}
	self.hRevealed = makeSet() :: any
	self.xRevealed = makeSet() :: any
	self.discovered = makeSet() :: any
	self.armAnim = {} :: any
	self.rainSpikes = {}
	self.evRuntime = {}
	self.particles = {}
	self.trailBuf = {}
	self.trailClock = 0
	self.camX = 0
	self.shake = 0
	self.flashUntil = 0
	self.revealUntil = 0
	self.reverseUntil = 0
	self.deadUntil = 0
	self.coyoteT = 0
	self.landT = 0
	self.keys = {} :: any
	self.touchKeys = {} :: any
	self.lastJumpPress = -1e9
	self.inputBound = false
	self.toastText = ""
	self.toastUntil = 0
	self.clock = 0
	self.lastTs = 0
	self.acc = 0
	self.farSquares = {}

	self:build()

	local rnd = seededRand(level.id * 7919 + 13)
	for _ = 1, 46 do
		table.insert(self.farSquares, { x = rnd() * 4200, y = rnd() * self.viewH, s = 6 + rnd() * 34, a = 0.03 + rnd() * 0.07 })
	end
	if (self.opts :: any).keyboard then self:bindInput() end
	return self
end

-- 0-indexed grid read helper. c in [0,W), r in [0,H).
function Engine:charAtGrid(c: number, r: number): string
	local row = self.grid[r + 1]
	if not row then return " " end
	local ch = row[c + 1]
	return ch or " "
end

-- Public query used by bots + gameplay (0-indexed, mirrors web charAt).
function Engine:charAt(c: number, r: number): string
	if c < 0 or c >= self.level.W then return "#" end
	if r < 0 or r >= self.level.H then return " " end
	return self:charAtGrid(c, r)
end

function Engine:solidAt(c: number, r: number): boolean
	local ch = self:charAt(c, r)
	if ch == "#" or ch == "=" or ch == "K" or ch == "B" or ch == "b" then return true end
	if ch == "D" then
		local d = self.dMap[c .. "," .. r]
		return d ~= nil and not d.gone
	end
	if ch == "_" then
		local p = self.pMap[c .. "," .. r]
		return p ~= nil and not p.gone
	end
	if ch == "H" then return self.hRevealed:has(c .. "," .. r) end
	return false
end

function Engine:hazardAt(c: number, r: number): boolean
	local ch = self:charAt(c, r)
	return ch == "^" or ch == "v" or ch == "X"
end

function Engine:guardInFront(tiles: number): boolean
	local dir = if self.vx >= 0 then 1 else -1
	local y0 = self.py - 8
	local y1 = self.py + self.ph + 8
	for _, g in ipairs(self.guards) do
		if not g.fake and g.alive then
			if not (g.y + g.h < y0 or g.y > y1) then
				if dir > 0 then
					if g.x > self.px and g.x < self.px + self.pw + tiles * Engine.TILE then return true end
				else
					if g.x + g.w < self.px + self.pw and g.x + g.w > self.px - tiles * Engine.TILE then return true end
				end
			end
		end
	end
	return false
end

local function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh)
	return ax < bx + bw and ax + aw > bx and ay < by + bh and ay + ah > by
end
Engine.rectsOverlap = rectsOverlap

function Engine:build()
	local L = self.level
	self.grid = {}
	for r = 1, L.H do
		local row = {}
		local src = L.rows[r]
		for c = 1, L.W do row[c] = src:sub(c, c) end
		self.grid[r] = row
	end
	self.coinMap = {}; self.dMap = {}; self.pMap = {}
	self.guards = {}; self.buttons = {}; self.drones = {}
	self.hRevealed = makeSet(); self.xRevealed = makeSet()
	self.checkpoints = {}; self.rainSpikes = {}
	self.placedFlag = nil
	self.evRuntime = {}
	for _ in ipairs(L.events) do table.insert(self.evRuntime, { fired = false, nextAt = 0 }) end
	self.particles = {}; self.trailBuf = {}
	self.deaths = 0; self.coins = 0; self.runMs = 0
	self.won = false; self.dead = false; self.gravSign = 1
	self.reverseUntil = 0; self.revealUntil = 0; self.shake = 0

	for r = 0, L.H - 1 do
		for c = 0, L.W - 1 do
			local ch = self:charAtGrid(c, r)
			if ch == "S" then
				self.spawn = { x = c * Engine.TILE + (Engine.TILE - self.pw) / 2, y = (r + 1) * Engine.TILE - self.ph }
				self.grid[r + 1][c + 1] = " "
			elseif ch == "G" then
				self.goal = { col = c, row = r, x = c * Engine.TILE, y = r * Engine.TILE }
				self.goalDrawX = c * Engine.TILE
				self.grid[r + 1][c + 1] = " "
			elseif ch == "C" or ch == "c" then
				self.coinMap[c .. "," .. r] = { col = c, row = r, taken = false, fake = ch == "c" }
				self.grid[r + 1][c + 1] = " "
			elseif ch == "P" or ch == "F" then
				table.insert(self.checkpoints, { col = c, row = r, fake = ch == "F", discovered = false, active = false })
				self.grid[r + 1][c + 1] = " "
			elseif ch == "D" then
				self.dMap[c .. "," .. r] = { col = c, row = r, timer = 0, gone = false, fy = 0 }
			elseif ch == "_" then
				self.pMap[c .. "," .. r] = { col = c, row = r, timer = 0, gone = false, fy = 0 }
			elseif ch == "E" or ch == "e" then
				local w, h = 24, 24
				table.insert(self.guards, {
					col = c, row = r,
					x = c * Engine.TILE + (Engine.TILE - w) / 2,
					y = (r + 1) * Engine.TILE - h,
					w = w, h = h,
					spawnX = c * Engine.TILE + (Engine.TILE - w) / 2,
					dir = 1, spawnDir = 1,
					fake = ch == "e", alive = true, discovered = false,
				})
				self.grid[r + 1][c + 1] = " "
			elseif ch == "O" or ch == "o" then
				table.insert(self.buttons, { col = c, row = r, baseY = (r + 1) * Engine.TILE, fake = ch == "o", pressed = false, discovered = false })
				self.grid[r + 1][c + 1] = " "
			end
		end
	end

	-- Snap button bases to the first solid surface below.
	for _, b in ipairs(self.buttons) do
		local groundRow = b.row + 1
		while groundRow < L.H and not self:solidAt(b.col, groundRow) do
			groundRow += 1
		end
		if groundRow < L.H then b.baseY = groundRow * Engine.TILE end
	end

	self.respawn = { x = self.spawn.x, y = self.spawn.y }
	self.px = self.spawn.x
	self.py = self.spawn.y
	self.vx = 0; self.vy = 0
	self.camX = self:clampCam(self.px + self.pw / 2 - self.viewW * 0.42)
end

function Engine:rebuild(forgetTraps: boolean?)
	if forgetTraps then
		self.discovered:clear()
		table.clear(self.armAnim)
	end
	self:build()
	self.toastText = ""
end

function Engine:clampCam(x: number): number
	return math.max(0, math.min(math.max(0, self.levelW - self.viewW), x))
end

function Engine:bindInput()
	-- Keyboard input is handled by the Play screen calling press(); the engine
	-- keeps the same shape as web but Roblox owns the InputBegan/InputEnded.
	self.inputBound = true
end

function Engine:unbindInput()
	self.inputBound = false
	table.clear(self.keys)
	table.clear(self.touchKeys)
end

function Engine:press(code: string, down: boolean)
	if down then
		self.touchKeys[code] = true
		if table.find(JUMP_CODES, code) then self.lastJumpPress = nowMs() end
	else
		self.touchKeys[code] = nil
	end
end

function Engine:start()
	self.started = true
	self.lastTs = os.clock()
end

function Engine:destroy()
	self.started = false
	self:unbindInput()
end

function Engine:setPalette(p: Palette) self.pal = p end
function Engine:setSkin(id: string) self.skin = id end
function Engine:setTrail(id: string) self.trail = id end

function Engine:useReveal(): boolean
	if self.dead or self.won then return false end
	self:revealFlash(2000)
	if not (self.opts :: any).silent then Audio.sfx.reveal() end
	self:emitToast("EVERYTHING IS VISIBLE. YOU'RE WELCOME.")
	return true
end

function Engine:revealFlash(ms: number)
	self.revealUntil = math.max(self.revealUntil, self.clock + ms)
end

function Engine:placeCheckpoint(): boolean
	if self.dead or self.won or not self.grounded then return false end
	self.placedFlag = { x = self.px + self.pw / 2, y = self.py + self.ph }
	self.respawn = { x = self.px, y = self.py }
	if not (self.opts :: any).silent then Audio.sfx.checkpoint() end
	self:burst(self.px + self.pw / 2, self.py + self.ph / 2, self.pal.accent, 10, 160)
	self:emitToast("ANCHOR DROPPED.")
	if self.cb.onCheckpoint then (self.cb :: any).onCheckpoint() end
	return true
end

-- ———————————————————— SIMULATION ————————————————————

function Engine:step(dt: number)
	self.clock += dt * 1000

	if self.dead then
		self:updateParticles(dt)
		if self.clock >= self.deadUntil then self:respawnPlayer() end
		return
	end
	if self.won then
		self:updateParticles(dt)
		self.goalDrawX += (self.goal.x - self.goalDrawX) * math.min(1, dt * 8)
		return
	end

	self.runMs += dt * 1000
	local controller = (self.opts :: any).controller
	if controller then controller(self, dt) end

	local function down(codes)
		for _, c in ipairs(codes) do
			if self.keys[c] or self.touchKeys[c] then return true end
		end
		return false
	end
	local holdL = down(LEFT_CODES) or self.input.left
	local holdR = down(RIGHT_CODES) or self.input.right
	local move = (if holdR then 1 else 0) - (if holdL then 1 else 0)
	if self.clock < self.reverseUntil then move = -move end

	local accel = if self.grounded then RUN_ACCEL else AIR_ACCEL
	if move ~= 0 then
		self.vx += move * accel * dt
		self.vx = math.max(-MAX_RUN, math.min(MAX_RUN, self.vx))
	elseif self.grounded then
		local s = sign(self.vx)
		self.vx -= s * FRICTION * dt
		if sign(self.vx) ~= s then self.vx = 0 end
	else
		self.vx *= 1 - math.min(1, 0.4 * dt)
	end

	self.coyoteT = if self.grounded then COYOTE else math.max(0, self.coyoteT - dt)
	local jumpHeld = down(JUMP_CODES) or self.input.jumpHeld
	local pressedBuffered = (nowMs() - self.lastJumpPress) < BUFFER * 1000
	if pressedBuffered and self.coyoteT > 0 then
		self.vy = -JUMP_VEL * self.gravSign
		self.grounded = false
		self.coyoteT = 0
		self.lastJumpPress = -1e9
		if not (self.opts :: any).silent then Audio.sfx.jump() end
	end
	if not jumpHeld and sign(self.vy) == -self.gravSign and math.abs(self.vy) > 240 then
		self.vy *= 1 - math.min(0.5, 5 * dt)
	end

	self.vy += GRAV * self.gravSign * dt
	if self.vy > MAX_FALL then self.vy = MAX_FALL end
	if self.vy < -MAX_FALL then self.vy = -MAX_FALL end

	self:moveX(dt)
	self:moveY(dt)
	if self.dead then return end
	self:updateDrones(dt)
	self:updateGuards(dt)

	self.landT = math.max(0, self.landT - dt)
	self.goalDrawX += (self.goal.x - self.goalDrawX) * math.min(1, dt * 8)

	self:checkHazardsAndPickups(dt)
	self:checkEvents()
	self:updateParticles(dt)
	self:updateTrail(dt)

	if self.py > self.levelH + 72 or self.py < -220 then
		self:die("void")
		return
	end

	local facing = if self.vx >= 0 then 1 else -1
	local target = self.px + self.pw / 2 - self.viewW * 0.42 + facing * 60
	local clamped = self:clampCam(target)
	self.camX += (clamped - self.camX) * math.min(1, dt * 7)
	if math.abs(clamped - self.camX) > 500 then self.camX = clamped end
	self.shake = math.max(0, self.shake - dt * 26)
end

function Engine:moveX(dt: number)
	self.px += self.vx * dt
	local top = math.floor(self.py / Engine.TILE)
	local bottom = math.floor((self.py + self.ph - 1) / Engine.TILE)
	if self.vx > 0 then
		local c = math.floor((self.px + self.pw) / Engine.TILE)
		for r = top, bottom do
			if self:solidAt(c, r) then
				self.px = c * Engine.TILE - self.pw - 0.01
				self.vx = 0
				break
			end
		end
	elseif self.vx < 0 then
		local c = math.floor(self.px / Engine.TILE)
		for r = top, bottom do
			if self:solidAt(c, r) then
				self.px = (c + 1) * Engine.TILE + 0.01
				self.vx = 0
				break
			end
		end
	end
end

function Engine:moveY(dt: number)
	self.py += self.vy * dt
	local left = math.floor((self.px + 2) / Engine.TILE)
	local right = math.floor((self.px + self.pw - 2) / Engine.TILE)
	local wasGrounded = self.grounded
	self.grounded = false

	if self.vy > 0 then
		local r = math.floor((self.py + self.ph) / Engine.TILE)
		for c = left, right do
			local spring = self:charAt(c, r) == "K"
			if self:solidAt(c, r) then
				self.py = r * Engine.TILE - self.ph - 0.01
				if self.gravSign == 1 then
					self.grounded = true
					if not wasGrounded then
						self.landT = 0.09
						if not (self.opts :: any).silent and self.vy > 500 then Audio.sfx.land() end
					end
					if spring then self:bounceSpring() end
				end
				if not spring then self.vy = 0 end
				break
			end
		end
	elseif self.vy < 0 then
		local r = math.floor(self.py / Engine.TILE)
		for c = left, right do
			local key = c .. "," .. r
			local ch = self:charAt(c, r)
			if ch == "H" and not self.hRevealed:has(key) and self.gravSign == 1 then
				self.hRevealed:add(key)
				self.py = (r + 1) * Engine.TILE + 0.01
				self.vy = 0
				if not (self.opts :: any).silent then Audio.sfx.bump() end
				self:bumpTile(c, r)
				break
			end
			if ch == "B" then
				self.grid[r + 1][c + 1] = " "
				self.coins += 1
				if self.cb.onCoin then (self.cb :: any).onCoin(self.coins) end
				self:emitToast("A COIN. IN THIS ECONOMY.")
				if not (self.opts :: any).silent then
					Audio.sfx.coin(); Audio.sfx.bump()
				end
				self:burst(c * Engine.TILE + Engine.TILE / 2, r * Engine.TILE + Engine.TILE / 2, self.pal.accent, 12, 220)
				self.py = (r + 1) * Engine.TILE + 0.01
				self.vy = 0
				break
			end
			local spring = ch == "K"
			if self:solidAt(c, r) then
				self.py = (r + 1) * Engine.TILE + 0.01
				if self.gravSign == -1 then
					self.grounded = true
					if not wasGrounded then self.landT = 0.09 end
					if spring then self:bounceSpring() end
				end
				if not spring then self.vy = 0 end
				break
			end
		end
	end

	-- standing support check
	if self.vy == 0 then
		local r = math.floor((self.py + (if self.gravSign == 1 then self.ph + 1 else -1)) / Engine.TILE)
		local supported = false
		for c = left, right do
			if self:solidAt(c, r) then
				supported = true
				local ch = self:charAt(c, r)
				if ch == "D" then
					local d = self.dMap[c .. "," .. r]
					if d and not d.gone then
						d.timer += 1.2 / 60
						if d.timer > 0.5 then
							d.gone = true
							d.fy = r * Engine.TILE
							if not (self.opts :: any).silent then Audio.sfx.bump() end
							supported = false
						end
					end
				end
				if ch == "_" then
					local p = self.pMap[c .. "," .. r]
					if p and not p.gone then
						p.timer += 1.2 / 60
						if p.timer > 0.32 then
							p.gone = true
							p.fy = r * Engine.TILE
							if not (self.opts :: any).silent then Audio.sfx.bump() end
							self:burst(c * Engine.TILE + Engine.TILE / 2, r * Engine.TILE + Engine.TILE / 2, self.pal.subtle, 8, 160)
							supported = false
						end
					end
				end
				if ch == "b" then
					self.grid[r + 1][c + 1] = " "
					self:explodeAt(c * Engine.TILE + Engine.TILE / 2, r * Engine.TILE + Engine.TILE / 2)
					self:die("bomb")
					return
				end
				if ch == "B" then
					self.grid[r + 1][c + 1] = " "
					self.coins += 1
					if self.cb.onCoin then (self.cb :: any).onCoin(self.coins) end
					self:emitToast("A COIN. IN THIS ECONOMY.")
					if not (self.opts :: any).silent then
						Audio.sfx.coin(); Audio.sfx.bump()
					end
					self:burst(c * Engine.TILE + Engine.TILE / 2, r * Engine.TILE + Engine.TILE / 2, self.pal.accent, 12, 220)
					supported = false
				end
				if ch == "K" and self.gravSign == 1 and math.abs(self.py + self.ph - r * Engine.TILE) < 2 then
					self:bounceSpring()
				end
			end
		end
		if self.gravSign == 1 then self.grounded = supported end
	end
end

function Engine:bounceSpring()
	self.vy = -SPRING_VEL * self.gravSign
	self.grounded = false
	self.landT = 0
	if not (self.opts :: any).silent then Audio.sfx.spring() end
	self:burst(self.px + self.pw / 2, self.py + self.ph / 2, self.pal.accent, 8, 200)
end

function Engine:explodeAt(x, y)
	self.shake = math.max(self.shake, 15)
	self:burst(x, y, self.pal.text, 24, 430)
	self:burst(x, y, self.pal.accent, 18, 360)
	self:burst(x, y, self.pal.subtle, 12, 300)
	if not (self.opts :: any).silent then
		Audio.sfx.spike(); Audio.sfx.bump()
	end
end

function Engine:bumpTile(c, r)
	for _ = 1, 6 do
		table.insert(self.particles, {
			x = c * Engine.TILE + Engine.TILE / 2, y = (r + 1) * Engine.TILE,
			vx = (math.random() - 0.5) * 200, vy = 60 + math.random() * 120,
			life = 0, maxLife = 0.4, size = 3 + math.random() * 3,
			color = self.pal.subtle, grav = 500,
		})
	end
end

function Engine:armTrap(c, r)
	local key = c .. "," .. r
	if self.discovered:has(key) then return end
	self.discovered:add(key)
	self.armAnim[key] = self.clock
	if not (self.opts :: any).silent then Audio.sfx.spike() end
	for _ = 1, 4 do
		table.insert(self.particles, {
			x = c * Engine.TILE + Engine.TILE / 2 + (math.random() - 0.5) * Engine.TILE,
			y = r * Engine.TILE + Engine.TILE / 2,
			vx = (math.random() - 0.5) * 120, vy = -60 - math.random() * 90,
			life = 0, maxLife = 0.35, size = 2 + math.random() * 3,
			color = self.pal.subtle, grav = 700,
		})
	end
end

function Engine:armNearbyTraps()
	local L = self.level
	local cc = math.floor((self.px + self.pw / 2) / Engine.TILE)
	local cr = math.floor((self.py + self.ph / 2) / Engine.TILE)
	for r = math.max(0, cr - 2), math.min(L.H - 1, cr + 2) do
		for c = math.max(0, cc - 2), math.min(L.W - 1, cc + 2) do
			local ch = self:charAtGrid(c, r)
			if ch == "^" or ch == "v" then
				if not self.discovered:has(c .. "," .. r) then
					local dx = math.abs(self.px + self.pw / 2 - (c * Engine.TILE + Engine.TILE / 2))
					local dy = math.abs(self.py + self.ph / 2 - (r * Engine.TILE + Engine.TILE / 2))
					if dx < Engine.TILE * 1.45 and dy < Engine.TILE * 1.3 then
						self:armTrap(c, r)
					end
				end
			end
		end
	end
end

function Engine:spawnDrone(b)
	local w, h = 18, 14
	table.insert(self.drones, {
		x = b.col * Engine.TILE + (Engine.TILE - w) / 2,
		y = b.row * Engine.TILE - h - 8,
		w = w, h = h,
		phase = math.random() * math.pi * 2,
		armedAt = self.clock + 650,
		alive = true,
	})
end

function Engine:updateDrones(dt: number)
	local tx = self.px + self.pw / 2
	local ty = self.py + self.ph / 2
	for _, d in ipairs(self.drones) do
		if not d.alive then continue end
		if self.clock < d.armedAt then
			d.y += math.sin((self.clock + d.phase) / 90) * 10 * dt
		else
			local cx = d.x + d.w / 2
			local cy = d.y + d.h / 2
			local dx = tx - cx
			local dy = ty - cy
			local len = math.sqrt(dx * dx + dy * dy)
			if len == 0 then len = 1 end
			local speed = 132
			d.x += (dx / len) * speed * dt
			d.y += (dy / len) * speed * dt + math.sin((self.clock + d.phase) / 110) * 12 * dt
		end
	end
	local nd = {}
	for _, d in ipairs(self.drones) do
		if d.alive then table.insert(nd, d) end
	end
	self.drones = nd
end

function Engine:guardBlocked(x, y, w, h, dir): boolean
	local aheadCol = if dir > 0 then math.floor((x + w + 2) / Engine.TILE) else math.floor((x - 2) / Engine.TILE)
	local topRow = math.floor((y + 1) / Engine.TILE)
	local feetRow = math.floor((y + h - 1) / Engine.TILE)
	for r = topRow, feetRow do
		if self:solidAt(aheadCol, r) or self:hazardAt(aheadCol, r) then return true end
	end
	if not self:solidAt(aheadCol, feetRow + 1) then return true end
	for _, s in ipairs(self.rainSpikes) do
		if rectsOverlap(x, y, w, h, s.col * Engine.TILE + 6, s.y + 14, Engine.TILE - 12, Engine.TILE - 14) then
			return true
		end
	end
	return false
end

function Engine:updateGuards(dt: number)
	for _, g in ipairs(self.guards) do
		if not g.alive then continue end
		local speed = 54
		local nx = g.x + g.dir * speed * dt
		if self:guardBlocked(nx, g.y, g.w, g.h, g.dir) then
			g.dir = if g.dir == 1 then -1 else 1
			nx = g.x
		end
		g.x = nx
	end
end

function Engine:checkHazardsAndPickups(dt: number)
	local L = self.level
	local pc = { x = self.px, y = self.py, w = self.pw, h = self.ph }

	self:armNearbyTraps()

	local c0 = math.floor(self.px / Engine.TILE) - 1
	local c1 = math.floor((self.px + self.pw) / Engine.TILE) + 1
	local r0 = math.floor(self.py / Engine.TILE) - 1
	local r1 = math.floor((self.py + self.ph) / Engine.TILE) + 1
	for r = math.max(0, r0), math.min(L.H - 1, r1) do
		for c = math.max(0, c0), math.min(L.W - 1, c1) do
			local ch = self:charAtGrid(c, r)
			if ch == "^" then
				if rectsOverlap(pc.x, pc.y, pc.w, pc.h, c * Engine.TILE + 6, r * Engine.TILE + 18, Engine.TILE - 12, Engine.TILE - 18) then
					self:armTrap(c, r); self:die("spike"); return
				end
			elseif ch == "v" then
				if rectsOverlap(pc.x, pc.y, pc.w, pc.h, c * Engine.TILE + 6, r * Engine.TILE, Engine.TILE - 12, Engine.TILE - 18) then
					self:armTrap(c, r); self:die("spike"); return
				end
			elseif ch == "X" then
				if rectsOverlap(pc.x, pc.y, pc.w, pc.h, c * Engine.TILE + 4, r * Engine.TILE + 4, Engine.TILE - 8, Engine.TILE - 4) then
					self.xRevealed:add(c .. "," .. r)
					self:die("fakeflag")
					return
				end
			end
		end
	end

	-- rain spikes
	for _, s in ipairs(self.rainSpikes) do
		if not s.landed then
			s.vy += GRAV * dt * 0.9
			s.y += s.vy * dt
			local target = s.landRow * Engine.TILE
			if s.y >= target then
				s.y = target
				s.landed = true
				if not (self.opts :: any).silent then Audio.sfx.spike() end
				self:burst(s.col * Engine.TILE + Engine.TILE / 2, s.y + Engine.TILE, self.pal.tile, 5, 130)
			end
		end
		if rectsOverlap(pc.x, pc.y, pc.w, pc.h, s.col * Engine.TILE + 6, s.y + 14, Engine.TILE - 12, Engine.TILE - 14) then
			self:die("spike")
			return
		end
	end

	-- coins
	for _, coin in pairs(self.coinMap) do
		if coin.taken then continue end
		local cx = coin.col * Engine.TILE + Engine.TILE / 2
		local cy = coin.row * Engine.TILE + Engine.TILE / 2
		if rectsOverlap(pc.x, pc.y, pc.w, pc.h, cx - 9, cy - 9, 18, 18) then
			coin.taken = true
			if coin.fake then
				self.coins = math.max(0, self.coins - 1)
				self:emitToast("COUNTERFEIT. MINUS ONE COIN.")
				if not (self.opts :: any).silent then Audio.sfx.denied() end
				self:burst(cx, cy, self.pal.tile, 8, 160)
			else
				self.coins += 1
				if not (self.opts :: any).silent then Audio.sfx.coin() end
				self:burst(cx, cy, self.pal.accent, 7, 170)
			end
			if self.cb.onCoin then (self.cb :: any).onCoin(self.coins) end
		end
	end

	-- checkpoints
	for _, cp in ipairs(self.checkpoints) do
		local cx = cp.col * Engine.TILE
		local cy = cp.row * Engine.TILE
		if not rectsOverlap(pc.x, pc.y, pc.w, pc.h, cx - 4, cy - Engine.TILE, Engine.TILE + 8, Engine.TILE * 2) then continue end
		if cp.fake then
			if not cp.discovered then
				cp.discovered = true
				self:emitToast(FAKE_CHECKPOINT_MESSAGE)
				if not (self.opts :: any).silent then Audio.sfx.denied() end
			end
		elseif not cp.active then
			for _, o in ipairs(self.checkpoints) do o.active = false end
			cp.active = true
			self.respawn = { x = cp.col * Engine.TILE + (Engine.TILE - self.pw) / 2, y = (cp.row + 1) * Engine.TILE - self.ph }
			if not (self.opts :: any).silent then Audio.sfx.checkpoint() end
			self:burst(cx + Engine.TILE / 2, cy + Engine.TILE / 2, self.pal.accent, 12, 180)
			self:emitToast("CHECKPOINT.")
			if self.cb.onCheckpoint then (self.cb :: any).onCheckpoint() end
		end
	end

	-- buttons
	for _, b in ipairs(self.buttons) do
		local bx = b.col * Engine.TILE
		if not rectsOverlap(pc.x, pc.y, pc.w, pc.h, bx + 2, b.baseY - Engine.TILE, Engine.TILE - 4, Engine.TILE) then continue end
		if b.fake then
			if not b.pressed then
				b.pressed = true
				b.discovered = true
				self:spawnDrone(b)
				self:emitToast("TRAP BUTTON. DRONE DEPLOYED.")
				if not (self.opts :: any).silent then Audio.sfx.denied() end
				self:burst(bx + Engine.TILE / 2, b.baseY - 10, self.pal.subtle, 12, 180)
			end
		elseif not b.pressed then
			b.pressed = true
			self:emitToast("NOTHING HAPPENS.")
			if not (self.opts :: any).silent then Audio.sfx.click() end
		end
	end

	-- guards
	for _, g in ipairs(self.guards) do
		if not rectsOverlap(pc.x, pc.y, pc.w, pc.h, g.x, g.y, g.w, g.h) then continue end
		if g.fake then
			if not g.discovered then
				g.discovered = true
				self:emitToast("JUST A MIME.")
				if not (self.opts :: any).silent then Audio.sfx.denied() end
				self:burst(g.x + g.w / 2, g.y + g.h / 2, self.pal.subtle, 8, 150)
			end
			continue
		end
		if not g.alive then continue end
		local falling = self.vy * self.gravSign > 120
		local fromAbove = self.py + self.ph - g.y < 18
		if falling and fromAbove then
			g.alive = false
			self.vy = -430 * self.gravSign
			self.grounded = false
			self:emitToast("STOMPED. IT WAS REAL.")
			if not (self.opts :: any).silent then Audio.sfx.bump() end
			self:burst(g.x + g.w / 2, g.y + g.h / 2, self.pal.text, 12, 210)
		else
			self:die("enemy")
			return
		end
	end

	-- drones
	for _, d in ipairs(self.drones) do
		if d.alive and rectsOverlap(pc.x, pc.y, pc.w, pc.h, d.x, d.y, d.w, d.h) then
			d.alive = false
			self:explodeAt(d.x + d.w / 2, d.y + d.h / 2)
			self:die("drone")
			return
		end
	end

	-- goal
	local gx = self.goal.x
	local gy = self.goal.y
	if not self.won and rectsOverlap(pc.x, pc.y, pc.w, pc.h, gx - 6, gy - Engine.TILE, Engine.TILE + 12, Engine.TILE * 2 + 6) then
		self:win()
	end
end

function Engine:checkEvents()
	local pc = { x = self.px, y = self.py, w = self.pw, h = self.ph }
	for i, ev in ipairs(self.level.events) do
		local rt = self.evRuntime[i]
		local ex = ev.x * Engine.TILE
		local ey = ev.y * Engine.TILE
		local ew = ev.w * Engine.TILE
		local eh = ev.h * Engine.TILE
		if not rectsOverlap(pc.x, pc.y, pc.w, pc.h, ex, ey, ew, eh) then continue end

		if ev.type == "flip" then
			if self.gravSign ~= ev.sign then
				self.gravSign = ev.sign
				self.vy = 60 * self.gravSign
				self.grounded = false
				if ev.text then self:emitToast(ev.text) end
				if not (self.opts :: any).silent then Audio.sfx.flip() end
				self:burst(pc.x + pc.w / 2, pc.y + pc.h / 2, self.pal.text, 14, 240)
				self.shake = math.max(self.shake, 5)
			end
		elseif ev.type == "reverse" then
			if self.clock >= rt.nextAt then
				rt.nextAt = self.clock + (ev.cooldownMs or 6000)
				self.reverseUntil = self.clock + (ev.sec or 3) * 1000
				if ev.text then self:emitToast(ev.text) end
				if not (self.opts :: any).silent then Audio.sfx.reverse() end
			end
		elseif ev.type == "goalshift" then
			if rt.fired and ev.once ~= false then continue end
			rt.fired = true
			self.goal.col += (ev.dx or 0)
			self.goal.x = self.goal.col * Engine.TILE
			if ev.text then self:emitToast(ev.text) end
			if not (self.opts :: any).silent then Audio.sfx.shift() end
			self:burst(self.goal.x + Engine.TILE / 2, self.goal.y + Engine.TILE / 2, self.pal.text, 12, 240)
		elseif ev.type == "spikefall" then
			if rt.fired and ev.once ~= false then continue end
			rt.fired = true
			for _, col in ipairs(ev.at or {}) do
				table.insert(self.rainSpikes, { col = col, y = -Engine.TILE * 1.5, vy = 120, landed = false, landRow = ev.landY or 11 })
			end
			if ev.text then self:emitToast(ev.text) end
			self.shake = math.max(self.shake, 4)
		else -- msg
			if rt.fired and ev.once ~= false then continue end
			if self.clock < rt.nextAt then continue end
			rt.fired = true
			rt.nextAt = self.clock + 4000
			if ev.text then self:emitToast(ev.text) end
		end
	end
end

function Engine:win()
	if self.won then return end
	self.won = true
	local stats = { timeMs = math.floor(self.runMs), deaths = self.deaths, coins = self.coins }
	if not (self.opts :: any).silent then Audio.sfx.win() end
	local gx = self.goal.x + Engine.TILE / 2
	local gy = self.goal.y
	for i = 1, 5 do
		local col = if i % 2 == 1 then self.pal.text else self.pal.accent
		self:burst(gx + (math.random() - 0.5) * 40, gy + math.random() * 40, col, 10, 320)
	end
	if self.cb.onWin then (self.cb :: any).onWin(stats) end
end

function Engine:die(reason)
	if self.dead or self.won then return end
	self.dead = true
	self.deaths += 1
	local pack = (TAUNTS :: any)[self.tauntKey] or TAUNTS.classic
	local message
	if reason == "fakeflag" then
		message = FAKE_FLAG_MESSAGE
	elseif reason == "bomb" then
		message = "IT WAS A BOMB."
	elseif reason == "drone" then
		message = "DRONE DELIVERY."
	elseif reason == "enemy" then
		message = "THAT ONE WAS REAL."
	else
		message = pack[math.random(#pack)]
	end
	self.deadUntil = self.clock + 620
	self.flashUntil = self.clock + 110
	self.shake = 12
	if not (self.opts :: any).silent then Audio.sfx.die() end
	self:burst(self.px + self.pw / 2, self.py + self.ph / 2, self.pal.player, 26, 380)
	self:burst(self.px + self.pw / 2, self.py + self.ph / 2, self.pal.accent, 10, 260)
	self:emitToast(message)
	if self.cb.onDeath then (self.cb :: any).onDeath({ count = self.deaths, message = message }) end
end

function Engine:respawnPlayer()
	self.px = self.respawn.x
	self.py = self.respawn.y
	self.vx = 0; self.vy = 0
	self.gravSign = 1
	self.reverseUntil = 0
	self.dead = false
	self.trailBuf = {}
	self.drones = {}
	for _, d in pairs(self.dMap) do d.timer = 0; d.gone = false end
	for _, p in pairs(self.pMap) do p.timer = 0; p.gone = false end
	for _, g in ipairs(self.guards) do
		g.alive = true
		g.x = g.spawnX
		g.dir = g.spawnDir
	end
	self.flashUntil = self.clock + 70
	self.camX = self:clampCam(self.px + self.pw / 2 - self.viewW * 0.42)
end

function Engine:emitToast(text: string)
	self.toastText = text
	self.toastUntil = self.clock + 2100
	if self.cb.onToast then (self.cb :: any).onToast(text) end
end

function Engine:burst(x, y, color, count, speed)
	for _ = 1, count do
		local a = math.random() * math.pi * 2
		local v = speed * (0.4 + math.random() * 0.8)
		table.insert(self.particles, {
			x = x, y = y,
			vx = math.cos(a) * v, vy = math.sin(a) * v - 60,
			life = 0, maxLife = 0.5 + math.random() * 0.45,
			size = 2 + math.random() * 5, color = color, grav = 900,
		})
	end
end

function Engine:updateParticles(dt: number)
	for i = #self.particles, 1, -1 do
		local p = self.particles[i]
		p.life += dt
		if p.life >= p.maxLife then
			table.remove(self.particles, i)
		else
			p.vy += p.grav * dt
			p.x += p.vx * dt
			p.y += p.vy * dt
		end
	end
end

function Engine:updateTrail(dt: number)
	if self.trail == "trail:none" then return end
	self.trailClock += dt
	if self.trailClock > 0.028 then
		self.trailClock = 0
		table.insert(self.trailBuf, { x = self.px, y = self.py })
		if #self.trailBuf > 26 then table.remove(self.trailBuf, 1) end
	end
	if self.trail == "trail:pixels" and math.abs(self.vx) > 80 and math.random() < 0.5 then
		table.insert(self.particles, {
			x = self.px + self.pw / 2, y = self.py + self.ph - 2,
			vx = -self.vx * 0.25 + (math.random() - 0.5) * 60,
			vy = -30 - math.random() * 60,
			life = 0, maxLife = 0.5, size = 2 + math.random() * 3,
			color = self.pal.accent, grav = 300,
		})
	end
end

function Engine:hud()
	return {
		deaths = self.deaths,
		coins = self.coins,
		timeMs = math.floor(self.runMs),
		reversed = self.clock < self.reverseUntil,
		paused = self.paused,
		won = self.won,
	}
end

return Engine
