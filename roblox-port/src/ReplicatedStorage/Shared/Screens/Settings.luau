--!strict
-- EXOTIC Settings screen — port of src/app/settings/page.tsx. Theme, sound/
-- volume, screen shake, cosmetic equips, sign out, account delete.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local App = require(Shared:WaitForChild("App"))
local Ui = require(Shared:WaitForChild("Ui"))
local Catalog = require(Shared:WaitForChild("Catalog"))
local Remotes = require(Shared:WaitForChild("Remotes"))
local Audio = require(Shared:WaitForChild("Audio"))

local Settings = {}
Settings.__index = Settings

function Settings.build()
	local self = setmetatable({}, Settings)
	local shell = Ui.shell({
		parent = App.root, name = "Settings", title = "SETTINGS", backLabel = "← Home",
		onBack = function() App.navigate("Home") end, theme = App.state.theme, visible = false,
	})
	self.screen = shell.screen
	self.body = shell.body
	self.controls = {}

	-- THEME
	self:addHeading("THEME")
	self.themeRow = self:addSegmented({ "dark", "light" }, function(v) self:patch({ theme = v }) end)

	-- SOUND
	self:addHeading("SOUND")
	self.soundRow = self:addToggle("soundBtn", function(on) self:patch({ sound = on }) end)

	-- VOLUME
	self:addHeading("VOLUME")
	self.volumeRow = self:addSlider(function(v) self:patch({ volume = v }) end)

	-- SCREEN SHAKE
	self:addHeading("SCREEN SHAKE")
	self.shakeRow = self:addToggle("shakeBtn", function(on) self:patch({ shake = on }) end)

	-- EQUIP SKIN / TRAIL / TAUNT
	self:addHeading("EQUIPPED SKIN")
	self.skinRow = self:addEquipPicker("skin")
	self:addHeading("EQUIPPED TRAIL")
	self.trailRow = self:addEquipPicker("trail")
	self:addHeading("EQUIPPED TAUNT")
	self.tauntRow = self:addEquipPicker("taunt")

	-- account
	self:addHeading("ACCOUNT")
	local row = Instance.new("Frame"); row.AutomaticSize = Enum.AutomaticSize.Y; row.Size = UDim2.new(1, 0, 0, 44); row.BackgroundTransparency = 1; row.Parent = self.body
	local rl = Instance.new("UIListLayout"); rl.FillDirection = Enum.FillDirection.Horizontal; rl.Padding = UDim.new(0, 10); rl.Parent = row
	self.acctLabel = Ui.label({ parent = row, text = "", color = Ui.tokens(App.state.theme).mut, font = Ui.FONT_MONO, textSize = 12, size = UDim2.new(1, -260, 0, 40), xAlign = Enum.TextXAlignment.Left })

	self.deleteBtn = Ui.pill({ parent = row, label = "DELETE ACCOUNT", variant = "ghost", size = "sm", theme = App.state.theme, width = 160, onClick = function() self:armDelete() end })

	return self
end

function Settings:addHeading(text)
	local tok = Ui.tokens(App.state.theme)
	local l = Ui.label({ parent = self.body, text = text, color = tok.mut, font = Ui.FONT_MONO_BOLD, textSize = 11, size = UDim2.new(1, 0, 0, 20), order = #self.controls + 1 })
	l.Position = UDim2.new(0, 0, 0, 0)
	-- use layout order via a wrapper frame for spacing
	local wrap = Instance.new("Frame")
	wrap.Size = UDim2.new(1, 0, 0, 44)
	wrap.BackgroundTransparency = 1
	wrap.LayoutOrder = #self.controls + 1
	wrap.Parent = self.body
	l.Parent = wrap
	l.Position = UDim2.new(0, 0, 0, 0)
	l.Size = UDim2.new(1, 0, 0, 20)
	table.insert(self.controls, wrap)
	return wrap
end

-- helper to add a labeled control row under the last heading
function Settings:attachRow(factory)
	local wrap = Instance.new("Frame")
	wrap.Size = UDim2.new(1, 0, 0, 42)
	wrap.BackgroundTransparency = 1
	wrap.LayoutOrder = #self.controls + 1
	wrap.Parent = self.body
	table.insert(self.controls, wrap)
	factory(wrap)
	return wrap
end

function Settings:addSegmented(options, onChange)
	local wrap = self:attachRow(function(w)
		local tok = Ui.tokens(App.state.theme)
		local seg = Instance.new("Frame")
		seg.Size = UDim2.new(0, 10, 0, 36)
		seg.AutomaticSize = Enum.AutomaticSize.X
		seg.BackgroundColor3 = tok.pan
		seg.Parent = w
		Ui.corner(seg, 18)
		local l = Instance.new("UIListLayout"); l.FillDirection = Enum.FillDirection.Horizontal; l.Padding = UDim.new(0, 4); l.Parent = seg
		Ui.pad(seg, 4, 4, 4, 4)
		self.segButtons = {}
		for _, opt in ipairs(options) do
			local b = Instance.new("TextButton")
			b.AutoButtonColor = false
			b.Size = UDim2.new(0, 10, 0, 28)
			b.AutomaticSize = Enum.AutomaticSize.X
			b.BackgroundTransparency = 1
			b.TextColor3 = tok.mut
			b.Text = string.upper(opt)
			b.FontFace = Ui.FONT_MONO_BOLD
			b.TextSize = 12
			b.Parent = seg
			Ui.pad(b, 18, 0, 18, 0)
			b.MouseButton1Click:Connect(function() Audio.sfx.toggle(); onChange(opt) end)
			table.insert(self.segButtons, { btn = b, value = opt })
		end
	end)
	self.segWrap = wrap
	return wrap
end

function Settings:addToggle(fieldName, onChange)
	return self:attachRow(function(w)
		local tok = Ui.tokens(App.state.theme)
		local b = Instance.new("TextButton")
		b.AutoButtonColor = false
		b.Size = UDim2.new(0, 72, 0, 32)
		b.BackgroundColor3 = tok.pan
		b.TextColor3 = tok.fg
		b.Text = "OFF"
		b.FontFace = Ui.FONT_MONO_BOLD
		b.TextSize = 12
		b.BorderSizePixel = 0
		b.Parent = w
		Ui.corner(b, 16)
		if fieldName then self[fieldName] = b end
		b.MouseButton1Click:Connect(function()
			Audio.sfx.toggle()
			local on = b.Text == "OFF"
			onChange(on)
		end)
	end)
end

function Settings:addSlider(onChange)
	return self:attachRow(function(w)
		local tok = Ui.tokens(App.state.theme)
		local track = Instance.new("Frame")
		track.Size = UDim2.new(0, 220, 0, 8)
		track.BackgroundColor3 = tok.pan2
		track.BorderSizePixel = 0
		track.Parent = w
		track.Position = UDim2.new(0, 0, 0.5, -4)
		Ui.corner(track, 4)
		local fill = Instance.new("Frame")
		fill.Size = UDim2.new(0.6, 0, 1, 0)
		fill.BackgroundColor3 = tok.fg
		fill.BorderSizePixel = 0
		fill.Parent = track
		Ui.corner(fill, 4)
		self.sliderFill = fill
		local knob = Instance.new("Frame")
		knob.Size = UDim2.new(0, 16, 0, 16)
		knob.BackgroundColor3 = tok.fg
		knob.BorderSizePixel = 0
		knob.Position = UDim2.new(0.6, -8, 0.5, -8)
		knob.Parent = track
		Ui.corner(knob, 8)
		self.sliderKnob = knob
		self.sliderValue = Ui.label({ parent = w, text = "60", color = tok.mut, font = Ui.FONT_MONO_BOLD, textSize = 12, size = UDim2.new(0, 40, 0, 16), xAlign = Enum.TextXAlignment.Left })
		self.sliderValue.Position = UDim2.new(0, 232, 0.5, -8)

		-- click/drag to set
		local dragging = false
		local function setFromX(x)
			local rel = math.clamp((x - track.AbsolutePosition.X) / math.max(1, track.AbsoluteSize.X), 0, 1)
			local v = math.floor(rel * 100 + 0.5)
			fill.Size = UDim2.new(rel, 0, 1, 0)
			knob.Position = UDim2.new(rel, -8, 0.5, -8)
			self.sliderValue.Text = tostring(v)
			Audio.sfx.slider()
			onChange(v)
		end
		track.InputBegan:Connect(function(input)
			if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
				dragging = true
				setFromX(input.Position.X)
			end
		end)
		knob.InputBegan:Connect(function(input)
			if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then dragging = true end
		end)
		game:GetService("UserInputService").InputChanged:Connect(function(input)
			if dragging and (input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch) then
				setFromX(input.Position.X)
			end
		end)
		game:GetService("UserInputService").InputEnded:Connect(function(input)
			if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then dragging = false end
		end)
	end)
end

function Settings:addEquipPicker(category)
	local wrap = self:attachRow(function(w)
		local tok = Ui.tokens(App.state.theme)
		local picker = Instance.new("ScrollingFrame")
		picker.Size = UDim2.new(1, 0, 0, 40)
		picker.BackgroundTransparency = 1
		picker.ScrollBarThickness = 0
		picker.CanvasSize = UDim2.new(0, 0, 0, 0)
		picker.AutomaticCanvasSize = Enum.AutomaticSize.X
		picker.Parent = w
		local l = Instance.new("UIListLayout"); l.FillDirection = Enum.FillDirection.Horizontal; l.Padding = UDim.new(0, 8); l.Parent = picker
		self.pickers = self.pickers or {}
		local buttons = {}
		for _, item in ipairs(Catalog.SHOP_ITEMS) do
			if item.category == category then
				local b = Instance.new("TextButton")
				b.AutoButtonColor = false
				b.Size = UDim2.new(0, 10, 0, 32)
				b.AutomaticSize = Enum.AutomaticSize.X
				b.BackgroundColor3 = tok.pan
				b.TextColor3 = tok.fg
				b.Text = item.name
				b.FontFace = Ui.FONT_MONO_BOLD
				b.TextSize = 11
				b.BorderSizePixel = 0
				b.Parent = picker
				Ui.pad(b, 14, 0, 14, 0)
				Ui.corner(b, 16)
				b.MouseButton1Click:Connect(function()
					Audio.sfx.select()
					local field = category
					self:patch({ [field] = item.id })
				end)
				table.insert(buttons, { btn = b, id = item.id })
			end
		end
		self.pickers[category] = buttons
	end)
	return wrap
end

function Settings:patch(patch)
	task.spawn(function()
		local ok, res = pcall(function() return Remotes.PatchSettings:InvokeServer(patch) end)
		if ok and res and res.settings then
			local prevTheme = App.state.theme
			App.state.settings = res.settings
			if res.settings.theme and res.settings.theme ~= prevTheme then
				App.setTheme(res.settings.theme)
			end
			Audio.sfx.configure({
				enabled = res.settings.sound ~= false,
				volume = (res.settings.volume or 60) / 100,
			})
			self:refresh()
		end
	end)
end

function Settings:armDelete()
	if self.armed then return end
	self.armed = true
	self.deleteBtn.Text = "CONFIRM DELETE"
	self.deleteBtn.BackgroundColor3 = Color3.fromHex("8b1a1a")
	task.delay(4, function()
		self.armed = false
		if self.deleteBtn then
			self.deleteBtn.Text = "DELETE ACCOUNT"
			self.deleteBtn.BackgroundColor3 = Color3.new(0, 0, 0)
			self.deleteBtn.BackgroundTransparency = 1
		end
	end)
end

function Settings:refresh()
	local s = App.state.settings or {}
	-- segmented theme
	for _, seg in ipairs(self.segButtons or {}) do
		local tok = Ui.tokens(App.state.theme)
		if seg.value == s.theme then
			seg.btn.BackgroundColor3 = tok.fg
			seg.btn.TextColor3 = tok.bg
		else
			seg.btn.BackgroundTransparency = 1
			seg.btn.TextColor3 = tok.mut
		end
	end
	-- toggles
	if self.soundBtn then self.soundBtn.Text = if s.sound == false then "OFF" else "ON" end
	if self.shakeBtn then self.shakeBtn.Text = if s.shake == false then "OFF" else "ON" end
	-- volume
	local vol = s.volume or 60
	if self.sliderFill then self.sliderFill.Size = UDim2.new(vol / 100, 0, 1, 0) end
	if self.sliderKnob then self.sliderKnob.Position = UDim2.new(vol / 100, -8, 0.5, -8) end
	if self.sliderValue then self.sliderValue.Text = tostring(vol) end
	-- equipped pickers
	for category, buttons in pairs(self.pickers or {}) do
		local current = s[category]
		for _, entry in ipairs(buttons) do
			local tok = Ui.tokens(App.state.theme)
			local owned = App.ownedQty(entry.id) > 0 or entry.id:sub(-5) == ":solid" or entry.id:sub(-4) == ":none" or entry.id:sub(-7) == ":classic"
			if entry.id == current then
				entry.btn.BackgroundColor3 = tok.fg
				entry.btn.TextColor3 = tok.bg
			elseif not owned then
				entry.btn.BackgroundColor3 = tok.pan2
				entry.btn.TextColor3 = tok.mut
			else
				entry.btn.BackgroundColor3 = tok.pan
				entry.btn.TextColor3 = tok.fg
			end
		end
	end
	-- account
	local acct = App.state.account
	if acct then
		self.acctLabel.Text = string.format("SIGNED IN AS %s · ● %d COINS", string.upper(acct.username), App.coins())
	end
end

function Settings:onEnter()
	self:refresh()
end

function Settings:onExit() end

return Settings
