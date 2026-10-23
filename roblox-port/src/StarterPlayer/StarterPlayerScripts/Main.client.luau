--!strict
-- EXOTIC client entrypoint - boots the app, mounts every screen into the shared
-- Root, wires live theme re-theming, and starts the router on the Splash screen.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local function logStage(msg: string)
	print("[EXOTIC] " .. msg)
end

logStage("boot: loading app state")

local okBoot, bootErr = pcall(function()
	local Shared = ReplicatedStorage:WaitForChild("Shared")
	local App = require(Shared:WaitForChild("App"))

	logStage("loading screens")

	local Screens = {
		Splash = require(Shared:WaitForChild("Screens"):WaitForChild("Splash")),
		Home = require(Shared:WaitForChild("Screens"):WaitForChild("Home")),
		Levels = require(Shared:WaitForChild("Screens"):WaitForChild("Levels")),
		Shop = require(Shared:WaitForChild("Screens"):WaitForChild("Shop")),
		Play = require(Shared:WaitForChild("Screens"):WaitForChild("Play")),
		Leaderboard = require(Shared:WaitForChild("Screens"):WaitForChild("Leaderboard")),
		Achievements = require(Shared:WaitForChild("Screens"):WaitForChild("Achievements")),
		Settings = require(Shared:WaitForChild("Screens"):WaitForChild("Settings")),
		Credits = require(Shared:WaitForChild("Screens"):WaitForChild("Credits")),
		Locked = require(Shared:WaitForChild("Screens"):WaitForChild("Locked")),
	}

	logStage("building screens")

	local controllers = {}
	for name, mod in pairs(Screens) do
		local ok, ctrl = pcall(mod.build)
		if ok and ctrl then
			controllers[name] = ctrl
			App.register(name, ctrl)
		else
			warn("[EXOTIC] screen '" .. name .. "' failed to build: " .. tostring(ctrl))
		end
	end
	if next(controllers) == nil then
		warn("[EXOTIC] no screens built - check the errors above")
	end

	-- Live theme changes: re-apply internals via a screen's own retheme(), then
	-- rebuild the active screen so it is fully consistent with the new palette.
	local function retheme()
		for _, c in pairs(controllers) do
			if c.screen and c.retheme then
				pcall(function() c:retheme() end)
			end
		end
		local cur = App.currentScreen
		if cur and cur ~= "Play" and cur ~= "Splash" then
			task.spawn(function()
				local mod = Screens[cur]
				if mod and mod.build then
					local old = controllers[cur]
					if old and old.screen then old.screen:Destroy() end
					local ok2, rebuilt = pcall(mod.build)
					if ok2 and rebuilt then
						controllers[cur] = rebuilt
						App.screens[cur] = controllers[cur]
						App.currentScreen = nil
						App.navigate(cur)
					else
						warn("[EXOTIC] screen '" .. cur .. "' failed to rebuild after theme change: " .. tostring(rebuilt))
					end
				end
			end)
		end
	end
	App.onThemeChanged = retheme

	logStage("starting")

	App.start()
	App.navigate("Splash")
	logStage("boot complete: Splash")
end)

if not okBoot then
	warn("[EXOTIC] BOOT FAILED: " .. tostring(bootErr))
	warn(debug.traceback())
end
