--!strict
-- EXOTIC UI kit — a theme-aware port of the web design system (globals.css +
-- pill-button.tsx + screen-shell.tsx). Every builder derives colors from the
-- current App theme so light/dark swap live, matching the CSS variables.

local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Audio = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Audio"))

local Ui = {}

Ui.FONT_MONO_BOLD = Font.new("rbxasset://fonts/families/Inconsolata.json", Enum.FontWeight.Bold)
Ui.FONT_MONO = Font.new("rbxasset://fonts/families/Inconsolata.json", Enum.FontWeight.Medium)
Ui.FONT_HEAD = Font.new("rbxasset://fonts/families/Inconsolata.json", Enum.FontWeight.Bold)

-- theme tokens (light values; dark overrides below)
local THEMES = {
	light = {
		bg = "f1f1ee", fg = "101010", mut = "6d6d67",
		pan = "e4e4e0", pan2 = "d7d7d2", text = "000000",
	},
	dark = {
		bg = "0b0b0c", fg = "fafafa", mut = "8a8a86",
		pan = "17171a", pan2 = "202024", text = "fafafa",
	},
}

function Ui.tokens(theme)
	local t = THEMES[theme] or THEMES.dark
	return {
		bg = Color3.fromHex(t.bg), fg = Color3.fromHex(t.fg), mut = Color3.fromHex(t.mut),
		pan = Color3.fromHex(t.pan), pan2 = Color3.fromHex(t.pan2), text = Color3.fromHex(t.text),
	}
end

function Ui.corner(parent, radius)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, radius or 16)
	c.Parent = parent
	return c
end

function Ui.pad(parent, l, t, r, b)
	local p = Instance.new("UIPadding")
	p.PaddingLeft = UDim.new(0, l or 0)
	p.PaddingTop = UDim.new(0, t or 0)
	p.PaddingRight = UDim.new(0, r or 0)
	p.PaddingBottom = UDim.new(0, b or 0)
	p.Parent = parent
	return p
end

function Ui.stroke(parent, color, thickness, transparency)
	local s = Instance.new("UIStroke")
	s.Color = color
	s.Thickness = thickness or 1
	s.Transparency = transparency or 0
	s.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	s.Parent = parent
	return s
end

function Ui.label(props)
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.Size = props.size or UDim2.new(0, 0, 0, 20)
	if props.automatic then l.AutomaticSize = props.automatic end
	l.Text = props.text or ""
	l.TextColor3 = props.color
	l.FontFace = props.font or Ui.FONT_MONO
	l.TextSize = props.textSize or 14
	l.TextWrapped = props.wrapped == true
	l.TextXAlignment = props.xAlign or Enum.TextXAlignment.Left
	l.TextYAlignment = props.yAlign or Enum.TextYAlignment.Center
	l.TextTransparency = props.transparency or 0
	l.LayoutOrder = props.order or 0
	l.Parent = props.parent
	if props.name then l.Name = props.name end
	return l
end

-- Pill button. variant: "solid" | "soft" | "ghost". Mirrors PillButton.tsx.
function Ui.pill(props)
	local theme = props.theme or "dark"
	local tok = Ui.tokens(theme)
	local variant = props.variant or "solid"
	local size = props.size or "md"
	local heights = { sm = 34, md = 42, lg = 50 }
	local paddings = { sm = 16, md = 24, lg = 30 }
	local h = heights[size] or 42

	local b = Instance.new("TextButton")
	b.AutoButtonColor = false
	b.Selectable = false
	b.Size = UDim2.new(0, 10, 0, h)
	b.AutomaticSize = Enum.AutomaticSize.X
	b.BorderSizePixel = 0
	if props.width then
		b.AutomaticSize = Enum.AutomaticSize.None
		b.Size = UDim2.new(0, props.width, 0, h)
	end
	b.Text = props.label or ""
	b.FontFace = Ui.FONT_MONO_BOLD
	b.TextSize = if size == "sm" then 11 else 13
	b.TextXAlignment = Enum.TextXAlignment.Center

	if variant == "solid" then
		b.BackgroundColor3 = tok.fg
		b.TextColor3 = tok.bg
	elseif variant == "soft" then
		b.BackgroundColor3 = tok.pan
		b.TextColor3 = tok.fg
	else -- ghost
		b.BackgroundColor3 = Color3.new(0, 0, 0)
		b.BackgroundTransparency = 1
		b.TextColor3 = tok.fg
	end
	Ui.corner(b, 24)
	Ui.pad(b, paddings[size] or 24, 0, paddings[size] or 24, 0)
	if props.order then b.LayoutOrder = props.order end
	b.Parent = props.parent

	b.MouseEnter:Connect(function() Audio.sfx.hover() end)
	b.MouseButton1Click:Connect(function()
		Audio.sfx.nav()
		if props.onClick then props.onClick() end
	end)
	return b
end

-- Circular icon-ish button (pause, theme toggle). Returns TextButton.
function Ui.iconButton(props)
	local theme = props.theme or "dark"
	local tok = Ui.tokens(theme)
	local size = props.size or 36
	local b = Instance.new("TextButton")
	b.Name = props.name or "IconButton"
	b.AutoButtonColor = false
	b.Selectable = false
	b.Size = UDim2.new(0, size, 0, size)
	b.BackgroundColor3 = tok.pan
	b.TextColor3 = tok.fg
	b.Text = props.text or ""
	b.FontFace = Ui.FONT_MONO_BOLD
	b.TextSize = props.textSize or 16
	b.BorderSizePixel = 0
	Ui.corner(b, size / 2)
	if props.order then b.LayoutOrder = props.order end
	b.Parent = props.parent
	b.MouseEnter:Connect(function() Audio.sfx.hover() end)
	b.MouseButton1Click:Connect(function()
		Audio.sfx.click()
		if props.onClick then props.onClick() end
	end)
	return b
end

-- Pill stat chip used in HUD + win overlay.
function Ui.chip(props)
	local theme = props.theme or "dark"
	local tok = Ui.tokens(theme)
	local f = Instance.new("Frame")
	f.Size = UDim2.new(0, 10, 0, props.height or 36)
	f.AutomaticSize = Enum.AutomaticSize.X
	f.BorderSizePixel = 0
	local solid = props.solid
	f.BackgroundColor3 = if solid then tok.fg else tok.pan
	Ui.corner(f, 20)
	Ui.pad(f, 16, 0, 16, 0)
	local layout = Instance.new("UIListLayout")
	layout.FillDirection = Enum.FillDirection.Horizontal
	layout.VerticalAlignment = Enum.VerticalAlignment.Center
	layout.Padding = UDim.new(0, 6)
	layout.Parent = f
	local t = Instance.new("TextLabel")
	t.BackgroundTransparency = 1
	t.Size = UDim2.new(0, 0, 1, 0)
	t.AutomaticSize = Enum.AutomaticSize.X
	t.Text = props.text or ""
	t.TextColor3 = if solid then tok.bg else tok.fg
	t.FontFace = Ui.FONT_MONO_BOLD
	t.TextSize = props.textSize or 12
	t.Parent = f
	if props.order then f.LayoutOrder = props.order end
	f.Parent = props.parent
	return f, t
end

-- ScreenShell: header (back/title/right) + scrollable body. Mirrors ScreenShell.tsx.
function Ui.shell(props)
	local theme = props.theme or "dark"
	local tok = Ui.tokens(theme)

	local screen = Instance.new("Frame")
	screen.Name = props.name or "Screen"
	screen.Size = UDim2.new(1, 0, 1, 0)
	screen.BackgroundColor3 = tok.bg
	screen.BorderSizePixel = 0
	screen.Visible = props.visible == true
	screen.Parent = props.parent

	local container = Instance.new("Frame")
	container.Size = UDim2.new(1, -40, 1, -30)
	container.Position = UDim2.new(0, 20, 0, 15)
	container.BackgroundTransparency = 1
	container.Parent = screen

	-- header
	local header = Instance.new("Frame")
	header.Size = UDim2.new(1, 0, 0, 44)
	header.BackgroundTransparency = 1
	header.Parent = container

	if props.backLabel then
		local back = Ui.pill({
			parent = header, label = props.backLabel, variant = "ghost", size = "sm",
			theme = theme, width = 110, onClick = props.onBack,
		})
		back.Position = UDim2.new(0, 0, 0, 4)
	end

	local titleCol = Instance.new("Frame")
	titleCol.Size = UDim2.new(1, -240, 1, 0)
	titleCol.Position = UDim2.new(0, if props.backLabel then 120 else 0, 0, 0)
	titleCol.BackgroundTransparency = 1
	titleCol.Parent = header
	Ui.label({
		parent = titleCol, text = props.title or "", color = tok.fg,
		font = Ui.FONT_HEAD, textSize = 18, xAlign = Enum.TextXAlignment.Left,
		size = UDim2.new(1, 0, 0, 24),
	})

	-- right cluster
	local right = Instance.new("Frame")
	right.Size = UDim2.new(0, 10, 0, 44)
	right.AutomaticSize = Enum.AutomaticSize.X
	right.Position = UDim2.new(1, 0, 0, 0)
	right.AnchorPoint = Vector2.new(1, 0)
	right.BackgroundTransparency = 1
	right.Parent = header
	local rl = Instance.new("UIListLayout")
	rl.FillDirection = Enum.FillDirection.Horizontal
	rl.VerticalAlignment = Enum.VerticalAlignment.Center
	rl.Padding = UDim.new(0, 8)
	rl.SortOrder = Enum.SortOrder.LayoutOrder
	rl.Parent = right

	-- sub
	if props.sub then
		Ui.label({
			parent = container, text = props.sub, color = tok.mut,
			font = Ui.FONT_MONO, textSize = 12,
			size = UDim2.new(1, 0, 0, 20), order = 2,
		}).Position = UDim2.new(0, 0, 0, 46)
	end

	-- body (scrollable)
	local body = Instance.new("ScrollingFrame")
	body.Name = "Body"
	body.Size = UDim2.new(1, 0, 1, -86)
	body.Position = UDim2.new(0, 0, 0, 80)
	body.BackgroundTransparency = 1
	body.BorderSizePixel = 0
	body.ScrollBarThickness = 4
	body.ScrollBarImageColor3 = tok.mut
	body.CanvasSize = UDim2.new(0, 0, 0, 0)
	body.AutomaticCanvasSize = Enum.AutomaticSize.Y
	body.Parent = container

	return {
		screen = screen, body = body, header = header, right = right,
		container = container, tokens = tok, theme = theme,
	}
end

-- A grid/list layout helper.
function Ui.list(props)
	local l = Instance.new("UIListLayout")
	l.Padding = UDim.new(0, props.padding or 10)
	l.FillDirection = props.direction or Enum.FillDirection.Vertical
	l.SortOrder = Enum.SortOrder.LayoutOrder
	l.Wrap = props.wrap == true
	if props.wrap then
		l.HorizontalAlignment = Enum.HorizontalAlignment.Left
		l.VerticalAlignment = Enum.VerticalAlignment.Top
	end
	l.Parent = props.parent
	return l
end

function Ui.grid(props)
	local g = Instance.new("UIGridLayout")
	g.CellSize = props.cellSize
	g.CellPadding = props.cellPadding or UDim2.new(0, 12, 0, 12)
	g.SortOrder = Enum.SortOrder.LayoutOrder
	g.Parent = props.parent
	return g
end

function Ui.aspect(parent, ratio)
	local a = Instance.new("UIAspectRatioConstraint")
	a.AspectRatio = ratio
	a.AspectType = Enum.AspectType.ScaleWithParentSize
	a.DominantAxis = Enum.DominantAxis.Width
	a.Parent = parent
	return a
end

return Ui
