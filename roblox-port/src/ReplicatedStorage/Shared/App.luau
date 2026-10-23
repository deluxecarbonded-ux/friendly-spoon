--!strict
-- EXOTIC client app state — the port of src/components/providers.tsx plus a
-- tiny router. A single shared instance holds account/profile/settings/progress
-- and drives screen navigation + toasts for every screen.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Remotes = require(Shared:WaitForChild("Remotes"))
local Catalog = require(Shared:WaitForChild("Catalog"))
local Audio = require(Shared:WaitForChild("Audio"))

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local App = {}
App.state = {
	account = nil :: any,
	profile = nil :: any,
	settings = nil :: any,
	progress = nil :: any,
	owned = {} :: { [string]: number },
	unlockedLevel = 1,
	achievements = {} :: { [string]: number },
	theme = "dark",
}
App.ready = false
App.readyCallbacks = {}

-- ——— ScreenGui / Root ———
local function ensureGui()
	local gui = playerGui:FindFirstChild("ExoticGui")
	if not gui then
		gui = Instance.new("ScreenGui")
		gui.Name = "ExoticGui"
		gui.ResetOnSpawn = false
		gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
		gui.IgnoreGuiInset = true
		gui.Parent = playerGui
	end
	local root = gui:FindFirstChild("Root")
	if not root then
		root = Instance.new("Frame")
		root.Name = "Root"
		root.Size = UDim2.new(1, 0, 1, 0)
		root.BackgroundTransparency = 1
		root.Parent = gui
	end
	return gui, root
end

App.gui, App.root = ensureGui()

-- ——— theme ———
function App.palette()
	return Catalog.PALETTE[App.state.theme] or Catalog.PALETTE.dark
end

function App.setTheme(theme)
	App.state.theme = theme
	if App.onThemeChanged then App.onThemeChanged(theme) end
end

-- ——— toast system ———
local toastHolder = nil
local toastTimer = nil
local function ensureToastHolder()
	if toastHolder and toastHolder.Parent then return toastHolder end
	toastHolder = Instance.new("Frame")
	toastHolder.Name = "ToastHolder"
	toastHolder.Size = UDim2.new(1, 0, 0, 60)
	toastHolder.Position = UDim2.new(0, 0, 0.12, 0)
	toastHolder.BackgroundTransparency = 1
	toastHolder.Parent = App.root
	return toastHolder
end

local TONES = {
	error = Color3.fromHex("101010"),
	success = Color3.fromHex("101010"),
	silent = Color3.fromHex("101010"),
}

function App.notify(title, sub, tone)
	local holder = ensureToastHolder()
	for _, c in ipairs(holder:GetChildren()) do c:Destroy() end
	local bg = App.state.theme == "dark" and Color3.fromHex("fafafa") or Color3.fromHex("101010")
	local fg = App.state.theme == "dark" and Color3.fromHex("0b0b0c") or Color3.fromHex("f1f1ee")

	local pill = Instance.new("Frame")
	pill.Size = UDim2.new(0, 10, 0, 56)
	pill.AutomaticSize = Enum.AutomaticSize.X
	pill.Position = UDim2.new(0.5, 0, 0, 0)
	pill.AnchorPoint = Vector2.new(0.5, 0)
	pill.BackgroundColor3 = bg
	pill.BorderSizePixel = 0
	pill.Parent = holder
	local corner = Instance.new("UICorner"); corner.CornerRadius = UDim.new(0, 28); corner.Parent = pill
	local pad = Instance.new("UIPadding"); pad.PaddingLeft = UDim.new(0, 22); pad.PaddingRight = UDim.new(0, 22); pad.Parent = pill

	local stack = Instance.new("Frame")
	stack.Size = UDim2.new(0, 0, 1, 0)
	stack.AutomaticSize = Enum.AutomaticSize.X
	stack.BackgroundTransparency = 1
	stack.Parent = pill
	local layout = Instance.new("UIListLayout"); layout.FillDirection = Enum.FillDirection.Horizontal; layout.VerticalAlignment = Enum.VerticalAlignment.Center; layout.Parent = stack

	local col = Instance.new("Frame")
	col.AutomaticSize = Enum.AutomaticSize.Y
	col.Size = UDim2.new(0, 0, 1, 0)
	col.BackgroundTransparency = 1
	col.Parent = stack
	local cl = Instance.new("UIListLayout"); cl.Parent = col

	local t = Instance.new("TextLabel")
	t.BackgroundTransparency = 1
	t.Size = UDim2.new(0, 0, 0, 18)
	t.AutomaticSize = Enum.AutomaticSize.X
	t.Text = title
	t.TextColor3 = fg
	t.FontFace = Font.new("rbxasset://fonts/families/Inconsolata.json", Enum.FontWeight.Bold)
	t.TextSize = 14
	t.TextXAlignment = Enum.TextXAlignment.Left
	t.Parent = col
	if sub then
		local s = Instance.new("TextLabel")
		s.BackgroundTransparency = 1
		s.Size = UDim2.new(0, 0, 0, 14)
		s.AutomaticSize = Enum.AutomaticSize.X
		s.Text = sub
		s.TextTransparency = 0.35
		s.TextColor3 = fg
		s.FontFace = Font.new("rbxasset://fonts/families/Inconsolata.json", Enum.FontWeight.Regular)
		s.TextSize = 11
		s.TextXAlignment = Enum.TextXAlignment.Left
		s.Parent = col
	end

	Audio.sfx.toast()
	task.delay(2.4, function()
		if pill.Parent then pill:Destroy() end
	end)
end

-- ——— router ———
App.screens = {} :: { [string]: any }
App.currentScreen = nil :: string?
App.pendingScreen = nil :: string?

function App.register(name, screen)
	App.screens[name] = screen
	-- if a navigation to this screen was requested before it registered, run it
	if App.pendingScreen == name then
		App.pendingScreen = nil
		App.navigate(name)
	end
end

function App.navigate(name, arg)
	if not App.screens[name] then
		App.pendingScreen = name
		return
	end
	if App.currentScreen == name then
		local s = App.screens[name]
		if s.onEnter then
			task.spawn(function()
				local ok, err = pcall(function() s:onEnter(arg) end)
				if not ok then warn("[EXOTIC] onEnter '" .. name .. "': " .. tostring(err)) end
			end)
		end
		return
	end
	if App.currentScreen then
		local prev = App.screens[App.currentScreen]
		if prev then
			if prev.onExit then
				-- guarded so a throwing onExit can't block the next screen showing
				pcall(function() prev:onExit() end)
			end
			if prev.screen then prev.screen.Visible = false end
		end
	end
	local s = App.screens[name]
	if s.screen then s.screen.Visible = true end
	App.currentScreen = name
	if s.onEnter then
		task.spawn(function()
			local ok, err = pcall(function() s:onEnter(arg) end)
			if not ok then warn("[EXOTIC] onEnter '" .. name .. "': " .. tostring(err)) end
		end)
	end
end

-- ——— data ———
function App.applyState(data)
	if not data then return end
	App.state.account = data.account
	App.state.profile = data.profile
	App.state.settings = data.settings
	App.state.progress = data.progress or {}
	App.state.owned = data.owned or {}
	App.state.unlockedLevel = data.unlockedLevel or 1
	App.state.achievements = data.achievements or {}
	if data.settings and data.settings.theme then App.state.theme = data.settings.theme end
	Audio.sfx.configure({
		enabled = if data.settings then data.settings.sound ~= false else true,
		volume = if data.settings then (data.settings.volume or 60) / 100 else 0.6,
	})
end

function App.whenReady(cb)
	if App.ready then
		task.spawn(cb)
	else
		table.insert(App.readyCallbacks, cb)
	end
end

function App.refresh()
	local ok, data = pcall(function() return Remotes.FetchState:InvokeServer() end)
	if ok then App.applyState(data) end
	return ok
end

function App.start()
	task.spawn(function()
		Audio.sfx.unlock()
		App.refresh()
		App.ready = true
		if App.onReady then task.spawn(App.onReady) end
		for _, cb in ipairs(App.readyCallbacks) do task.spawn(cb) end
		table.clear(App.readyCallbacks)
	end)
end

-- currency helper
function App.coins()
	return if App.state.profile then App.state.profile.coins or 0 else 0
end

function App.ownedQty(id)
	return App.state.owned[id] or 0
end

return App
