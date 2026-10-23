--!strict
-- EXOTIC Home screen — port of src/app/page.tsx (hero, numbered nav, taunt
-- ticker, player chip, theme toggle).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local App = require(Shared:WaitForChild("App"))
local Ui = require(Shared:WaitForChild("Ui"))
local Catalog = require(Shared:WaitForChild("Catalog"))
local Audio = require(Shared:WaitForChild("Audio"))

local Home = {}
Home.__index = Home

local NAV = {
	{ key = "1", label = "PLAY", screen = "Levels", glyph = "▶" },
	{ key = "2", label = "SHOP", screen = "Shop", glyph = "▣" },
	{ key = "3", label = "LEVELS", screen = "Levels", glyph = "▤" },
	{ key = "4", label = "LEADERBOARD", screen = "Leaderboard", glyph = "▥" },
	{ key = "5", label = "ACHIEVEMENTS", screen = "Achievements", glyph = "♛" },
	{ key = "6", label = "SETTINGS", screen = "Settings", glyph = "⚙" },
	{ key = "7", label = "CREDITS", screen = "Credits", glyph = "ⓘ" },
}

function Home.build()
	local self = setmetatable({}, Home)
	local tok = Ui.tokens(App.state.theme)

	local screen = Instance.new("Frame")
	screen.Name = "Home"
	screen.Size = UDim2.new(1, 0, 1, 0)
	screen.BackgroundColor3 = tok.bg
	screen.BorderSizePixel = 0
	screen.Visible = false
	screen.Parent = App.root
	self.screen = screen

	-- top bar: brand + theme toggle + coins
	local top = Instance.new("Frame")
	top.Size = UDim2.new(1, -40, 0, 44)
	top.Position = UDim2.new(0, 20, 0, 12)
	top.BackgroundTransparency = 1
	top.Parent = screen
	local tl = Instance.new("UIListLayout"); tl.FillDirection = Enum.FillDirection.Horizontal; tl.VerticalAlignment = Enum.VerticalAlignment.Center; tl.Padding = UDim.new(0, 8); tl.Parent = top

	local brand = Instance.new("Frame"); brand.AutomaticSize = Enum.AutomaticSize.X; brand.Size = UDim2.new(0, 0, 0, 34); brand.BackgroundTransparency = 1; brand.Parent = top
	local bl = Instance.new("UIListLayout"); bl.FillDirection = Enum.FillDirection.Horizontal; bl.VerticalAlignment = Enum.VerticalAlignment.Center; bl.Padding = UDim.new(0, 6); bl.Parent = brand
	Ui.label({ parent = brand, text = "◆", color = tok.fg, font = Ui.FONT_MONO_BOLD, textSize = 20, size = UDim2.new(0, 22, 0, 24), xAlign = Enum.TextXAlignment.Center })
	Ui.label({ parent = brand, text = "EXOTIC", color = tok.fg, font = Ui.FONT_HEAD, textSize = 20, size = UDim2.new(0, 0, 1, 0), automatic = Enum.AutomaticSize.X })

	local spacer = Instance.new("Frame"); spacer.Size = UDim2.new(1, -300, 1, 0); spacer.BackgroundTransparency = 1; spacer.LayoutOrder = 50; spacer.Parent = top

	self.coinsChip, self.coinsText = Ui.chip({ parent = top, text = "● 0", theme = App.state.theme, height = 32, order = 60, textSize = 12 })
	self.themeBtn = Ui.iconButton({ parent = top, name = "Theme", text = "☾", size = 32, theme = App.state.theme, order = 70, textSize = 16, onClick = function() self:toggleTheme() end })

	-- player chip
	self.playerChip, self.playerText = Ui.chip({ parent = top, text = "PLAYER", theme = App.state.theme, height = 32, order = 65, textSize = 11 })

	-- hero
	local hero = Instance.new("Frame")
	hero.Size = UDim2.new(1, -40, 0, 200)
	hero.Position = UDim2.new(0, 20, 0, 90)
	hero.BackgroundTransparency = 1
	hero.Parent = screen
	local hl = Instance.new("UIListLayout"); hl.VerticalAlignment = Enum.VerticalAlignment.Center; hl.HorizontalAlignment = Enum.HorizontalAlignment.Left; hl.Padding = UDim.new(0, 6); hl.Parent = hero
	local kick = Ui.label({ parent = hero, text = "A MONOCHROME RAGE PLATFORMER", color = tok.mut, font = Ui.FONT_MONO, textSize = 13, size = UDim2.new(1, 0, 0, 20), order = 1 })
	local title = Ui.label({ parent = hero, text = "EXOTIC", color = tok.fg, font = Ui.FONT_HEAD, textSize = 72, size = UDim2.new(1, 0, 0, 88), order = 2 })
	local sub = Ui.label({ parent = hero, text = "Invisible traps. Fake flags. Bomb crates. Everything lies.", color = tok.mut, font = Ui.FONT_MONO, textSize = 14, size = UDim2.new(1, 0, 0, 22), order = 3 })

	-- nav list
	local nav = Instance.new("Frame")
	nav.Size = UDim2.new(1, -40, 0, 340)
	nav.Position = UDim2.new(0, 20, 0, 300)
	nav.BackgroundTransparency = 1
	nav.Parent = screen
	local nl = Instance.new("UIListLayout"); nl.Padding = UDim.new(0, 8); nl.Parent = nav
	self.navButtons = {}
	for i, item in ipairs(NAV) do
		local b = self:navRow(nav, item, i)
		table.insert(self.navButtons, { btn = b, screen = item.screen })
	end

	-- taunt ticker
	local ticker = Instance.new("TextLabel")
	ticker.Size = UDim2.new(1, -40, 0, 24)
	ticker.Position = UDim2.new(0, 20, 1, -34)
	ticker.BackgroundTransparency = 1
	ticker.TextColor3 = tok.mut
	ticker.FontFace = Ui.FONT_MONO
	ticker.TextSize = 12
	ticker.TextXAlignment = Enum.TextXAlignment.Left
	ticker.Text = ""
	ticker.Name = "Ticker"
	ticker.Parent = screen
	self.ticker = ticker
	self.tickerIndex = 1
	self.tickerThread = task.spawn(function()
		local all = {}
		for _, pack in pairs(Catalog.TAUNTS) do for _, t in ipairs(pack) do table.insert(all, t) end end
		while true do
			ticker.Text = "“ " .. all[(self.tickerIndex % #all) + 1] .. " ”"
			self.tickerIndex += 1
			task.wait(2.4)
		end
	end)

	-- hotkeys
	self.keyConn = game:GetService("UserInputService").InputBegan:Connect(function(input, gp)
		if gp or not screen.Visible then return end
		local n = nil
		if input.KeyCode == Enum.KeyCode.One then n = 1
		elseif input.KeyCode == Enum.KeyCode.Two then n = 2
		elseif input.KeyCode == Enum.KeyCode.Three then n = 3
		elseif input.KeyCode == Enum.KeyCode.Four then n = 4
		elseif input.KeyCode == Enum.KeyCode.Five then n = 5
		elseif input.KeyCode == Enum.KeyCode.Six then n = 6
		elseif input.KeyCode == Enum.KeyCode.Seven then n = 7 end
		if n and NAV[n] then Audio.sfx.nav(); App.navigate(NAV[n].screen) end
	end)

	return self
end

function Home:navRow(parent, item, order)
	local tok = Ui.tokens(App.state.theme)
	local b = Instance.new("TextButton")
	b.AutoButtonColor = false
	b.Size = UDim2.new(1, 0, 0, 44)
	b.BackgroundColor3 = tok.pan
	b.TextColor3 = tok.fg
	b.BorderSizePixel = 0
	b.LayoutOrder = order
	Ui.corner(b, 12)
	b.Parent = parent
	local row = Instance.new("Frame"); row.Size = UDim2.new(1, -24, 1, 0); row.Position = UDim2.new(0, 16, 0, 0); row.BackgroundTransparency = 1; row.Parent = b
	local rl = Instance.new("UIListLayout"); rl.FillDirection = Enum.FillDirection.Horizontal; rl.VerticalAlignment = Enum.VerticalAlignment.Center; rl.Padding = UDim.new(0, 12); rl.Parent = row
	Ui.label({ parent = row, text = item.key, color = tok.mut, font = Ui.FONT_MONO_BOLD, textSize = 14, size = UDim2.new(0, 18, 0, 24), xAlign = Enum.TextXAlignment.Center })
	Ui.label({ parent = row, text = item.glyph, color = tok.fg, font = Ui.FONT_MONO_BOLD, textSize = 18, size = UDim2.new(0, 24, 0, 24), xAlign = Enum.TextXAlignment.Center })
	Ui.label({ parent = row, text = item.label, color = tok.fg, font = Ui.FONT_MONO_BOLD, textSize = 16, size = UDim2.new(0, 0, 1, 0), automatic = Enum.AutomaticSize.X })
	b.MouseEnter:Connect(function() Audio.sfx.hover() end)
	b.MouseButton1Click:Connect(function()
		Audio.sfx.nav()
		App.navigate(item.screen)
	end)
	return b
end

function Home:toggleTheme()
	local nextTheme = if App.state.theme == "dark" then "light" else "dark"
	Audio.sfx.toggle()
	task.spawn(function()
		pcall(function()
			require(Shared:WaitForChild("Remotes")).PatchSettings:InvokeServer({ theme = nextTheme })
		end)
		App.setTheme(nextTheme)
	end)
end

function Home:refresh()
	self.coinsText.Text = string.format("● %d", App.coins())
	local acct = App.state.account
	self.playerText.Text = if acct then string.upper(acct.username or "PLAYER") else "PLAYER"
	self.themeBtn.Text = if App.state.theme == "dark" then "☾" else "☀"
end

function Home:onEnter()
	self:refresh()
end

function Home:onExit() end

return Home
