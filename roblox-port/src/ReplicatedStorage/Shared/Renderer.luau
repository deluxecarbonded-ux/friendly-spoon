--!strict
-- EXOTIC renderer — a pixel-accurate port of the web Canvas2D `draw()` routine
-- in src/game/engine.ts. Shapes are rasterized with a horizontal scanline
-- algorithm onto a pool of reusable Frames (no per-frame instance churn), so
-- triangles, circles and alpha blend match the canvas output closely.
--
-- All coordinates are world pixels; the camera + shake offset is baked into
-- every primitive's screen position.

local Renderer = {}
Renderer.__index = Renderer

local TILE = 32

-- Rasterize a filled triangle into 1-px-tall spans: { {y, x0, x1}, ... }
local function triSpans(ax, ay, bx, by, cx, cy)
	local spans = {}
	local minY = math.floor(math.min(ay, by, cy))
	local maxY = math.ceil(math.max(ay, by, cy))
	for y = minY, maxY - 1 do
		local sy = y + 0.5
		local xs = {}
		local edges = { { ax, ay, bx, by }, { bx, by, cx, cy }, { cx, cy, ax, ay } }
		for _, e in ipairs(edges) do
			local x1, y1, x2, y2 = e[1], e[2], e[3], e[4]
			if (y1 <= sy and y2 > sy) or (y2 <= sy and y1 > sy) then
				local t = (sy - y1) / (y2 - y1)
				table.insert(xs, x1 + t * (x2 - x1))
			end
		end
		if #xs >= 2 then
			table.sort(xs)
			table.insert(spans, { y, xs[1], xs[#xs] })
		end
	end
	return spans
end

function Renderer.new(stage: Frame)
	local self = setmetatable({}, Renderer)
	self.stage = stage
	self.pool = {} :: { Frame }
	self.n = 0
	self.camX = 0
	self.camY = 0
	self.shakeX = 0
	self.shakeY = 0
	self.pal = nil :: any
	self.now = 0

	-- A single background layer sits behind everything.
	local bg = Instance.new("Frame")
	bg.Name = "Bg"
	bg.Size = UDim2.new(1, 0, 1, 0)
	bg.BorderSizePixel = 0
	bg.ZIndex = 0
	bg.Parent = stage
	self.bg = bg
	return self
end

function Renderer:setPalette(pal)
	self.pal = pal
	self.bg.BackgroundColor3 = Color3.fromHex(pal.bg)
end

function Renderer:_next(): Frame
	self.n += 1
	local f = self.pool[self.n]
	if not f then
		f = Instance.new("Frame")
		f.BorderSizePixel = 0
		f.ZIndex = 2
		f.Parent = self.stage
		self.pool[self.n] = f
	end
	f.Visible = true
	return f
end

function Renderer:begin(camX, camY, shakeX, shakeY, pal, now)
	self.n = 0
	self.camX = camX
	self.camY = camY
	self.shakeX = shakeX
	self.shakeY = shakeY
	self.pal = pal
	self.now = now
end

function Renderer:finish()
	for i = self.n + 1, #self.pool do
		self.pool[i].Visible = false
	end
end

-- world-space rect → screen primitive
function Renderer:rect(x, y, w, h, color, alpha)
	if w <= 0 or h <= 0 then return end
	local f = self:_next()
	f.Position = UDim2.new(0, x - self.camX + self.shakeX, 0, y - self.camY + self.shakeY)
	f.Size = UDim2.new(0, w, 0, h)
	f.BackgroundColor3 = Color3.fromHex(color)
	f.BackgroundTransparency = 1 - (alpha or 1)
end

function Renderer:tri(ax, ay, bx, by, cx, cy, color, alpha)
	for _, s in ipairs(triSpans(ax, ay, bx, by, cx, cy)) do
		local y = s[1]
		local x0 = s[2]
		local x1 = s[3]
		self:rect(x0, y, math.max(1, x1 - x0), 1, color, alpha)
	end
end

function Renderer:circle(cx, cy, r, color, alpha)
	if r <= 0 then return end
	local minY = math.floor(cy - r)
	local maxY = math.ceil(cy + r)
	for y = minY, maxY - 1 do
		local dy = (y + 0.5) - cy
		local ad = math.abs(dy)
		if ad < r then
			local xhalf = math.sqrt(r * r - dy * dy)
			self:rect(cx - xhalf, y, xhalf * 2, 1, color, alpha)
		end
	end
end

function Renderer:ring(cx, cy, r, color, alpha, thickness)
	-- approximate stroke ring by drawing a filled circle then punching is not
	-- possible with opaque bg; instead draw as a set of short radial ticks.
	local steps = math.max(12, math.floor(r * 6))
	for i = 0, steps - 1 do
		local a = (i / steps) * math.pi * 2
		local x = cx + math.cos(a) * r
		local y = cy + math.sin(a) * r
		self:rect(x - thickness / 2, y - thickness / 2, thickness, thickness, color, alpha)
	end
end

function Renderer:strokeRect(x, y, w, h, color, alpha, t)
	t = t or 1.5
	self:rect(x, y, w, t, color, alpha)
	self:rect(x, y + h - t, w, t, color, alpha)
	self:rect(x, y, t, h, color, alpha)
	self:rect(x + w - t, y, t, h, color, alpha)
end

-- deterministic tile speck, matching engine.ts speck()
local function speckHash(c, r)
	local h = (c * 73856093) % 2147483647
	h = (h + r * 19349663) % 2147483647
	return h
end

function Renderer:speck(c, r, x, y)
	local h = speckHash(c, r)
	if h % 7 == 0 then
		self:rect(x + (math.floor(h / 8) % 20) + 4, y + (math.floor(h / 512) % 20) + 4, 4, 4, self.pal.bg, 0.14)
	end
end

function Renderer:drawCrate(x, y, revealTrap, now)
	local pal = self.pal
	self:rect(x + 1, y + 1, TILE - 2, TILE - 2, pal.tile, 1)
	self:rect(x + 5, y + TILE / 2 - 3, TILE - 10, 3, pal.bg, 0.4)
	self:rect(x + TILE / 2 - 3, y + 5, 3, TILE - 10, pal.bg, 0.4)
	self:rect(x + 5, y + 5, 4, 4, pal.bg, 0.7)
	self:rect(x + TILE - 9, y + 5, 4, 4, pal.bg, 0.7)
	self:rect(x + 5, y + TILE - 9, 4, 4, pal.bg, 0.7)
	self:rect(x + TILE - 9, y + TILE - 9, 4, 4, pal.bg, 0.7)
	if revealTrap then
		local a = 0.5 + 0.3 * math.sin(now / 70 + x)
		self:strokeRect(x + 2, y + 2, TILE - 4, TILE - 4, pal.text, a, 1.5)
		self:circle(x + TILE / 2, y + TILE / 2, 5, pal.bg, 1)
		self:rect(x + TILE / 2 + 2, y + TILE / 2 - 7, 2, 5, pal.bg, 1)
	end
end

function Renderer:drawSpikes(x, y, down, grow, alpha)
	local g = math.max(0, grow or 1)
	if g <= 0.001 then return end
	local pal = self.pal
	local n = 2
	local sw = TILE / n
	local full = TILE - 4
	local hgt = full * g
	for i = 0, n - 1 do
		if down then
			self:tri(x + i * sw, y, x + i * sw + sw / 2, y + hgt, x + (i + 1) * sw, y, pal.text, alpha or 1)
		else
			self:tri(x + i * sw, y + TILE, x + i * sw + sw / 2, y + TILE - hgt, x + (i + 1) * sw, y + TILE, pal.text, alpha or 1)
		end
	end
end

function Renderer:drawFlag(cx, baseY, revealed, flash)
	local pal = self.pal
	local alpha = 1
	if flash or revealed then
		alpha = if revealed then 0.5 else 0.5 + 0.3 * math.sin(self.now / 50)
	end
	self:rect(cx - 2, baseY - 46, 4, 46, pal.text, alpha)
	if revealed then
		self:tri(cx + 2, baseY - 44, cx + 24, baseY - 26, cx + 2, baseY - 18, pal.text, alpha)
	else
		self:tri(cx + 2, baseY - 46, cx + 26, baseY - 38, cx + 2, baseY - 30, pal.text, alpha)
	end
end

function Renderer:drawGoal(cx, baseY, now)
	local pal = self.pal
	local wave = math.sin(now / 240) * 3
	self:rect(cx - 2, baseY - 58, 4, 62, pal.text, 1)
	self:tri(cx + 2, baseY - 58, cx + 30, baseY - 50 + wave, cx + 2, baseY - 40, pal.text, 1)
	-- checkered cap
	for i = 0, 2 do
		for j = 0, 1 do
			if (i + j) % 2 == 0 then
				self:rect(cx + 2 + i * 5, baseY - 56 + j * 5, 5, 5, pal.bg, 1)
			end
		end
	end
end

function Renderer:drawPlayer(eng, now)
	local pal = self.pal
	local cx = eng.px + eng.pw / 2
	local cy = eng.py + eng.ph / 2
	local sxs, sys = 1, 1
	if eng.landT > 0 then
		sxs, sys = 1.22, 0.78
	elseif math.abs(eng.vy) > 640 then
		sxs, sys = 0.88, 1.12
	end

	local w, h = eng.pw, eng.ph
	-- apply grav flip by mirroring around center; squash/stretch by scaling
	local function tx(px) return cx + (px - 0) * sxs end
	local function ty(py)
		local v = (py - 0) * sys
		if eng.gravSign == -1 then v = -v end
		return cy + v
	end
	local lx, ly = -w / 2, -h / 2

	if eng.skin == "skin:ghost" then
		self:rect(tx(lx), ty(ly), w * sxs, h * sys, pal.player, 0.62)
		self:rect(tx(lx + 3), ty(ly - 4), w * sxs, 4 * sys, pal.player, 0.25)
	elseif eng.skin == "skin:hollow" then
		self:rect(tx(lx), ty(ly), w * sxs, h * sys, pal.player, 1)
		self:rect(tx(lx + 5), ty(ly + 5), (w - 10) * sxs, (h - 10) * sys, pal.bg, 1)
	elseif eng.skin == "skin:diagonal" then
		self:tri(tx(lx), ty(ly + h), tx(lx + w), ty(ly + h), tx(lx + w), ty(ly), pal.player, 1)
		self:tri(tx(lx), ty(ly), tx(lx), ty(ly + h), tx(lx + w), ty(ly), pal.player, 0.4)
	elseif eng.skin == "skin:checker" then
		local cw, chh = w / 2, h / 2
		for i = 0, 1 do
			for j = 0, 1 do
				local col = if (i + j) % 2 == 0 then pal.player else pal.subtle
				self:rect(tx(lx + i * cw), ty(ly + j * chh), cw * sxs + 0.5, chh * sys + 0.5, col, 1)
			end
		end
	else
		self:rect(tx(lx), ty(ly), w * sxs, h * sys, pal.player, 1)
	end

	-- eyes
	local blink = math.sin(now / 1400 + eng.level.id) > 0.985
	local look = math.max(-3, math.min(3, eng.vx / 90))
	local eyeCol = if eng.skin == "skin:hollow" then pal.player else pal.bg
	local eh = if blink then 1.5 else 5
	self:rect(tx(lx + 5 + look), ty(ly + 7), 4 * sxs, eh * sys, eyeCol, 1)
	self:rect(tx(lx + w - 9 + look), ty(ly + 7), 4 * sxs, eh * sys, eyeCol, 1)
end

function Renderer:drawTrail(eng)
	if eng.trail == "trail:none" or #eng.trailBuf < 2 then return end
	local pal = self.pal
	local buf = eng.trailBuf
	if eng.trail == "trail:comet" then
		local step = math.max(1, math.floor(#buf / 7))
		for i = 0, 6 do
			local p = buf[math.min(#buf, i * step + 1)]
			if p then
				local t = i / 7
				local r = 9 * t + 1.5
				self:circle(p.x + eng.pw / 2, p.y + eng.ph / 2, r, pal.player, 0.05 + t * 0.25)
			end
		end
	elseif eng.trail == "trail:shadow" then
		local idxs = { #buf - 8, #buf - 16, #buf - 24 }
		local alphas = { 0.16, 0.1, 0.06 }
		for k, idx in ipairs(idxs) do
			local p = if idx >= 0 then buf[idx + 1] else nil
			if p then
				self:rect(p.x, p.y, eng.pw, eng.ph, pal.player, alphas[k])
			end
		end
	end
end

function Renderer:render(eng, pal, dt)
	local now = eng.clock
	local viewW, viewH = eng.viewW, eng.viewH
	self:setPalette(pal)

	-- parallax + shake
	local shakeOn = eng.shake > 0 and eng.opts.shakeEnabled ~= false
	local shakeX = if shakeOn then (math.random() - 0.5) * eng.shake else 0
	local shakeY = if shakeOn then (math.random() - 0.5) * eng.shake else 0

	-- vertical camera
	local camY = eng.levelH - viewH
	if camY > 0 then
		camY = math.max(0, math.min(camY, eng.py + eng.ph / 2 - viewH * 0.58))
	end
	self:begin(eng.camX, camY, shakeX, shakeY, pal, now)

	-- parallax squares
	local wrapW = eng.levelW * 0.3 + viewW
	for _, sq in ipairs(eng.farSquares) do
		local x = (sq.x - eng.camX * 0.3) % wrapW
		if x < -60 then x += wrapW end
		self:rect(x - 60 + eng.camX, sq.y + camY, sq.s, sq.s, pal.far, sq.a)
	end

	local L = eng.level
	local c0 = math.max(0, math.floor(eng.camX / TILE) - 1)
	local c1 = math.min(L.W - 1, math.ceil((eng.camX + viewW) / TILE) + 1)
	local revealOn = now < eng.revealUntil

	-- tiles
	for r = 0, L.H - 1 do
		for c = c0, c1 do
			local ch = eng:charAtGrid(c, r)
			local x, y = c * TILE, r * TILE
			if ch == "#" then
				self:rect(x, y, TILE + 0.5, TILE + 0.5, pal.tile, 1)
				self:speck(c, r, x, y)
			elseif ch == "=" or ch == "_" then
				local p = if ch == "_" then eng.pMap[c .. "," .. r] else nil
				if not p or not p.gone then
					local wob = if p and p.timer > 0 then math.sin(now / 22) * 1.8 else 0
					self:rect(x, y + wob, TILE + 0.5, TILE + 0.5, pal.tile, 1)
					self:rect(x + 2, y + wob + TILE / 2 - 2, TILE - 4, 4, pal.bg, 0.35)
					if revealOn and p then
						self:rect(x + TILE / 2 - 3, y + wob + TILE / 2 - 3, 6, 6, pal.bg, 0.45 + 0.25 * math.sin(now / 70))
					end
				end
			elseif ch == "B" or ch == "b" then
				self:drawCrate(x, y, revealOn and ch == "b", now)
			elseif ch == "K" then
				self:rect(x, y, TILE + 0.5, TILE + 0.5, pal.tile, 1)
				self:rect(x + 6, y + 6, TILE - 12, TILE - 12, pal.bg, 1)
			elseif ch == "D" then
				local d = eng.dMap[c .. "," .. r]
				if d and not d.gone then
					local wob = if d.timer > 0 then math.sin(now / 24) * 1.6 else 0
					self:rect(x, y + wob, TILE + 0.5, TILE + 0.5, pal.tile, 1)
					self:speck(c, r, x, y + wob)
					if d.timer > 0.12 then
						self:rect(x + 4, y + wob + TILE / 2 - 1, TILE - 8, 2, pal.bg, 1)
					end
				end
			elseif ch == "H" then
				if eng.hRevealed:has(c .. "," .. r) then
					self:rect(x, y, TILE + 0.5, TILE + 0.5, pal.tile, 1)
					self:rect(x + TILE / 2 - 2, y + TILE / 2 - 2, 4, 4, pal.bg, 0.5)
				elseif revealOn then
					local pulse = 0.25 + 0.15 * math.sin(now / 60)
					self:rect(x, y, TILE, TILE, pal.tile, pulse)
				end
			elseif ch == "^" or ch == "v" then
				local key = c .. "," .. r
				if eng.discovered:has(key) then
					local t = eng.armAnim[key]
					local k = if t == nil then 1 else math.min(1, (now - t) / 150)
					local grow = if k >= 1 then 1 else 1.25 * math.sin((k * math.pi) / 2) - 0.25 * k
					self:drawSpikes(x, y, ch == "v", grow, 1)
				elseif revealOn then
					self:drawSpikes(x, y, ch == "v", 1, 0.3 + 0.18 * math.sin(now / 60))
				end
			elseif ch == "X" then
				self:drawFlag(x + TILE / 2, y + TILE, eng.xRevealed:has(c .. "," .. r), revealOn)
			elseif ch == ">" or ch == "<" then
				local dir = if ch == ">" then 1 else -1
				local cx = x + TILE / 2
				local cy = y + TILE / 2
				self:tri(cx - 6 * dir, cy - 7, cx + 7 * dir, cy, cx - 6 * dir, cy + 7, pal.subtle, 0.75)
			end
		end
	end

	-- coins
	for _, coin in pairs(eng.coinMap) do
		if coin.taken then continue end
		if coin.col < c0 - 1 or coin.col > c1 + 1 then continue end
		local cx = coin.col * TILE + TILE / 2
		local cy = coin.row * TILE + TILE / 2 + math.sin(now / 300 + coin.col) * 1.6
		local rr = 7 * (1 + 0.07 * math.sin(now / 180 + coin.col * 2))
		self:circle(cx, cy, rr, pal.accent, 1)
		self:rect(cx - 2.5, cy - 2.5, 5, 5, pal.bg, 1)
		if coin.fake and revealOn then
			self:ring(cx, cy, rr + 4, pal.text, 0.55 + 0.35 * math.sin(now / 70 + coin.col), 1.5)
		end
	end

	-- checkpoints
	for _, cp in ipairs(eng.checkpoints) do
		local cx = cp.col * TILE + TILE / 2
		local baseY = (cp.row + 1) * TILE
		local droop = cp.fake and (cp.discovered or revealOn)
		local col = if (cp.active or (cp.fake and cp.discovered)) then pal.accent else pal.text
		local alpha = if cp.fake and cp.discovered then 0.45 else 1
		self:rect(cx - 1.5, baseY - 34, 3, 34, col, alpha)
		if droop then
			self:tri(cx + 1.5, baseY - 32, cx + 17, baseY - 20, cx + 1.5, baseY - 16, col, alpha)
		else
			self:tri(cx + 1.5, baseY - 34, cx + 17, baseY - 28, cx + 1.5, baseY - 22, col, alpha)
		end
	end

	-- buttons
	for _, b in ipairs(eng.buttons) do
		local bx, baseY = b.col * TILE, b.baseY
		self:rect(bx + 6, baseY - 12, TILE - 12, 12, pal.tile, 1)
		local depress = (if b.pressed then 4 else 0) + (if b.fake and b.discovered then 3 else 0)
		local capCol = if b.fake and b.discovered then pal.subtle else pal.accent
		self:rect(bx + 8 + (if b.fake and b.discovered then 2 else 0), baseY - 18 + depress, TILE - 16, 7, capCol, 1)
		if revealOn and b.fake and not b.discovered then
			self:strokeRect(bx + 5, baseY - 21, TILE - 10, 18, pal.text, 0.5 + 0.3 * math.sin(now / 70), 1.5)
		end
	end

	-- guards
	for _, g in ipairs(eng.guards) do
		if not g.alive then continue end
		self:rect(g.x, g.y + 3, g.w, g.h - 7, pal.tile, 1)
		self:rect(g.x + 2, g.y + g.h - 6, 6, 6, pal.tile, 1)
		self:rect(g.x + g.w - 8, g.y + g.h - 6, 6, 6, pal.tile, 1)
		local look = g.dir * 3
		self:rect(g.x + 5 + look, g.y + 9, 5, 5, pal.bg, 1)
		self:rect(g.x + g.w - 10 + look, g.y + 9, 5, 5, pal.bg, 1)
		if g.fake and (g.discovered or revealOn) then
			self:strokeRect(g.x + 1, g.y + 2, g.w - 2, g.h - 3, pal.text, 0.45 + 0.25 * math.sin(now / 70 + g.col), 1.5)
		end
	end

	-- drones
	for _, d in ipairs(eng.drones) do
		if not d.alive then continue end
		local blade = math.sin(now / 40 + d.phase) * 3
		self:rect(d.x + 2, d.y + 4, d.w - 4, d.h - 6, pal.tile, 1)
		self:rect(d.x - 2, d.y + 2 + blade, d.w + 4, 3, pal.tile, 1)
		self:rect(d.x + d.w / 2 - 1, d.y + d.h - 4, 2, 4, pal.tile, 1)
		self:rect(d.x + d.w / 2 - 2, d.y + d.h / 2 - 1, 4, 4, pal.bg, 1)
		self:strokeRect(d.x - 3, d.y + 1, d.w + 6, d.h - 2, pal.subtle, 1, 1)
	end

	-- placed anchor flag
	if eng.placedFlag then
		local fx, fy = eng.placedFlag.x, eng.placedFlag.y
		self:rect(fx - 1.5, fy - 30, 3, 30, pal.text, 1)
		self:tri(fx + 1.5, fy - 30, fx + 14, fy - 25, fx + 1.5, fy - 20, pal.text, 1)
		self:rect(fx + 5, fy - 28, 3, 3, pal.bg, 1)
	end

	-- goal flag
	local gDrawX = if eng.won then eng.goal.x else eng.goalDrawX
	self:drawGoal(gDrawX + TILE / 2, eng.goal.y + TILE + TILE / 2, now)

	-- rain spikes
	for _, s in ipairs(eng.rainSpikes) do
		self:drawSpikes(s.col * TILE, if s.landed then s.landRow * TILE else s.y, false, 1, 1)
	end

	-- trail
	self:drawTrail(eng)

	-- player
	if not eng.dead then self:drawPlayer(eng, now) end

	-- particles
	for _, p in ipairs(eng.particles) do
		local t = p.life / p.maxLife
		local s = p.size * (1 - 0.5 * t)
		self:rect(p.x - s / 2, p.y - s / 2, s, s, p.color, 1 - t)
	end

	self:finish()

	-- death flash overlay (screen space)
	if now < eng.flashUntil then
		local a = 0.28 * ((eng.flashUntil - now) / 110)
		local f = self:_next()
		f.Position = UDim2.new(0, 0, 0, 0)
		f.Size = UDim2.new(1, 0, 1, 0)
		f.ZIndex = 5
		f.BackgroundColor3 = Color3.fromHex(pal.text)
		f.BackgroundTransparency = 1 - a
	end
end

return Renderer
