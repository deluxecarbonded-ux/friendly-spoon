--!strict
-- EXOTIC audio — port of src/game/audio.ts.
--
-- The web build synthesizes every effect with WebAudio oscillators/noise. Luau
-- cannot create oscillators, so this module maps each named effect onto the
-- closest sound that ships with Roblox (rbxasset://), preserving the timing,
-- layering and config (enabled/volume) of the original. Every public method
-- matches the web `sfx` API one-for-one so callers port verbatim.

local SoundService = game:GetService("SoundService")
local Debris = game:GetService("Debris")

local Audio = {}
local sfx = {}

local state = {
	enabled = true,
	volume = 0.6,
	ambientStarted = false,
	ambientAllowed = false,
}

-- name → { id, baseVolume, playbackSpeed }
local LIB = {
	jump = { "rbxasset://sounds/action_jump.mp3", 0.35, 1.0 },
	land = { "rbxasset://sounds/action_jump_land.mp3", 0.25, 1.0 },
	spring = { "rbxasset://sounds/action_fingflick.mp3", 0.4, 1.2 },
	coin = { "rbxasset://sounds/bell.mp3", 0.4, 1.4 },
	die = { "rbxasset://sounds/uuhhh.mp3", 0.6, 1.0 },
	bump = { "rbxasset://sounds/snap.mp3", 0.5, 1.0 },
	checkpoint = { "rbxasset://sounds/bell.mp3", 0.4, 1.0 },
	flip = { "rbxasset://sounds/electronicpingshort.wav", 0.5, 0.8 },
	reverse = { "rbxasset://sounds/electronicpingshort.wav", 0.45, 0.6 },
	reveal = { "rbxasset://sounds/electronicpingshort.wav", 0.5, 1.3 },
	spike = { "rbxasset://sounds/splat.mp3", 0.4, 1.0 },
	shift = { "rbxasset://sounds/electronicpingshort.wav", 0.5, 1.1 },
	win = { "rbxasset://sounds/bell.mp3", 0.5, 1.6 },
	click = { "rbxasset://sounds/buttonpress.wav", 0.4, 1.0 },
	denied = { "rbxasset://sounds/buttonrollover.wav", 0.4, 0.8 },
	buy = { "rbxasset://sounds/bell.mp3", 0.4, 1.2 },
	hover = { "rbxasset://sounds/buttonrollover.wav", 0.15, 1.6 },
	nav = { "rbxasset://sounds/button.wav", 0.3, 1.0 },
	select = { "rbxasset://sounds/buttonpress.wav", 0.35, 1.2 },
	toggle = { "rbxasset://sounds/buttonpress.wav", 0.35, 0.9 },
	open = { "rbxasset://sounds/button.wav", 0.3, 1.3 },
	close = { "rbxasset://sounds/button.wav", 0.3, 0.7 },
	type = { "rbxasset://sounds/buttonrollover.wav", 0.12, 2.0 },
	slider = { "rbxasset://sounds/buttonrollover.wav", 0.25, 1.4 },
	toast = { "rbxasset://sounds/electronicpingshort.wav", 0.3, 1.5 },
	success = { "rbxasset://sounds/bell.mp3", 0.4, 1.3 },
	achievement = { "rbxasset://sounds/bell.mp3", 0.5, 1.8 },
	fieldError = { "rbxasset://sounds/buttonrollover.wav", 0.3, 0.6 },
	pause = { "rbxasset://sounds/button.wav", 0.35, 0.8 },
	resume = { "rbxasset://sounds/button.wav", 0.35, 1.1 },
	restart = { "rbxasset://sounds/buttonpress.wav", 0.4, 0.7 },
	levelStart = { "rbxasset://sounds/electronicpingshort.wav", 0.45, 1.0 },
	boot = { "rbxasset://sounds/bell.mp3", 0.4, 1.0 },
	unlock = { "rbxasset://sounds/bell.mp3", 0.45, 1.5 },
}

local templates: { [string]: Sound } = {}
local live: { [string]: { Sound } } = {}

local function template(name: string): Sound?
	local entry = LIB[name]
	if not entry then return nil end
	local t = templates[name]
	if not t then
		t = Instance.new("Sound")
		t.Name = "Exotic_" .. name
		t.SoundId = entry[1]
		t.Volume = entry[2]
		t.PlaybackSpeed = entry[3]
		t.Parent = SoundService
		templates[name] = t
	end
	return t
end

local function play(name: string, speedMul: number?)
	if not state.enabled then return end
	local t = template(name)
	if not t then return end
	local entry = LIB[name]
	local list = live[name] or {}
	live[name] = list

	-- reuse an idle instance if one exists, else clone; cap concurrency
	local inst: Sound? = nil
	for _, s in ipairs(list) do
		if not s.IsPlaying then inst = s; break end
	end
	if not inst then
		if #list >= 4 then
			inst = list[1]
			table.remove(list, 1)
		else
			inst = t:Clone()
			inst.Parent = SoundService
			table.insert(list, inst)
		end
	end
	inst.Volume = (entry[2]) * state.volume
	inst.PlaybackSpeed = (entry[3]) * (speedMul or 1)
	inst.TimePosition = 0
	inst:Play()
	Debris:AddItem(inst, 3)
end

-- ——— public API (mirrors web sfx) ———
function sfx.configure(opts)
	if opts.enabled ~= nil then state.enabled = opts.enabled end
	if opts.volume ~= nil then state.volume = math.clamp(opts.volume, 0, 1) end
end
function sfx.unlock()
	state.ambientAllowed = true
end
function sfx.startAmbient() state.ambientStarted = true end
function sfx.stopAmbient() state.ambientStarted = false end

local names = {}
for name in pairs(LIB) do table.insert(names, name) end
for _, name in ipairs(names) do
	sfx[name] = function(speedMul: number?)
		play(name, speedMul)
	end
end

-- slight variations for layered effects (win chord, coin double, etc.)
sfx.coin = function()
	play("coin", 1.0)
	play("coin", 1.5)
end
sfx.win = function()
	play("win", 1.0)
	task.delay(0.09, function() play("win", 1.3) end)
	task.delay(0.18, function() play("win", 1.6) end)
end
sfx.achievement = function()
	play("achievement", 1.0)
	task.delay(0.08, function() play("achievement", 1.3) end)
	task.delay(0.16, function() play("achievement", 1.6) end)
end
sfx.die = function()
	play("die", 1.0)
	play("spike", 0.7)
end
sfx.explode = function()
	play("spike", 0.8)
	play("bump", 0.8)
end

Audio.sfx = sfx
Audio.getState = function()
	return state
end

return Audio
