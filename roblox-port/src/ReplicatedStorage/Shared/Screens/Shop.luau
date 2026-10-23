--!strict
-- EXOTIC Shop screen — port of src/app/shop/page.tsx. Four categories with
-- live per-item preview canvases, buy + equip.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local App = require(Shared:WaitForChild("App"))
local Ui = require(Shared:WaitForChild("Ui"))
local Catalog = require(Shared:WaitForChild("Catalog"))
local Preview = require(Shared:WaitForChild("Preview"))
local Remotes = require(Shared:WaitForChild("Remotes"))
local Audio = require(Shared:WaitForChild("Audio"))

local Shop = {}
Shop.__index = Shop

function Shop.build()
	local self = setmetatable({}, Shop)
	local shell = Ui.shell({
		parent = App.root, name = "Shop", title = "SHOP", backLabel = "← Home",
		onBack = function() App.navigate("Home") end, theme = App.state.theme, visible = false,
	})
	self.screen = shell.screen
	self.body = shell.body
	self.items = {}

	-- coins chip in header
	self.coinsChip, self.coinsText = Ui.chip({ parent = shell.right, text = "● 0", theme = App.state.theme, height = 32, textSize = 12, order = 1 })

	-- category tabs
	local tabs = Instance.new("Frame")
	tabs.Size = UDim2.new(1, 0, 0, 38)
	tabs.BackgroundTransparency = 1
	tabs.Parent = shell.body
	local tl = Instance.new("UIListLayout"); tl.FillDirection = Enum.FillDirection.Horizontal; tl.Padding = UDim.new(0, 8); tl.Parent = tabs
	self.tabButtons = {}
	self.activeCategory = "skin"
	for _, cat in ipairs(Catalog.CATEGORIES) do
		local b = Ui.pill({ parent = tabs, label = Catalog.categoryLabel(cat), variant = "soft", size = "sm", theme = App.state.theme, order = #self.tabButtons + 1, onClick = function() self:setCategory(cat) end })
		table.insert(self.tabButtons, { btn = b, cat = cat })
	end

	-- item list
	local list = Instance.new("Frame")
	list.Size = UDim2.new(1, 0, 0, 0)
	list.AutomaticSize = Enum.AutomaticSize.Y
	list.Position = UDim2.new(0, 0, 0, 48)
	list.BackgroundTransparency = 1
	list.Parent = shell.body
	local ll = Instance.new("UIListLayout"); ll.Padding = UDim.new(0, 10); ll.Parent = list
	self.list = list

	return self
end

function Shop:setCategory(cat)
	self.activeCategory = cat
	self:renderItems()
end

function Shop:renderItems()
	-- destroy old previews + rows
	for _, item in ipairs(self.items) do
		if item.preview then item.preview:destroy() end
		if item.row then item.row:Destroy() end
	end
	self.items = {}

	local tok = Ui.tokens(App.state.theme)
	for order, itemDef in ipairs(Catalog.SHOP_ITEMS) do
		if itemDef.category == self.activeCategory then
			table.insert(self.items, self:buildRow(itemDef, #self.items + 1))
		end
	end
	self:refresh()
end

function Shop:buildRow(itemDef, order)
	local tok = Ui.tokens(App.state.theme)
	local row = Instance.new("Frame")
	row.Size = UDim2.new(1, 0, 0, 96)
	row.BackgroundColor3 = tok.pan
	row.BorderSizePixel = 0
	row.LayoutOrder = order
	row.Parent = self.list
	Ui.corner(row, 14)

	-- preview
	local previewHolder = Instance.new("Frame")
	previewHolder.Size = UDim2.new(0, 140, 1, -16)
	previewHolder.Position = UDim2.new(0, 8, 0, 8)
	previewHolder.BackgroundColor3 = Color3.fromHex(if App.state.theme == "dark" then "0b0b0c" else "f1f1ee")
	previewHolder.BorderSizePixel = 0
	previewHolder.ClipsDescendants = true
	previewHolder.Parent = row
	Ui.corner(previewHolder, 10)

	-- text
	Ui.label({ parent = row, text = itemDef.name, color = tok.fg, font = Ui.FONT_HEAD, textSize = 16, size = UDim2.new(1, -320, 0, 22), order = 2 }).Position = UDim2.new(0, 158, 0, 14)
	Ui.label({ parent = row, text = itemDef.blurb, color = tok.mut, font = Ui.FONT_MONO, textSize = 11, size = UDim2.new(1, -320, 0, 40), wrapped = true, order = 3 }).Position = UDim2.new(0, 158, 0, 38)

	-- action button
	local action = Instance.new("TextButton")
	action.AutoButtonColor = false
	action.Size = UDim2.new(0, 120, 0, 38)
	action.Position = UDim2.new(1, -12, 0.5, -19)
	action.AnchorPoint = Vector2.new(1, 0)
	action.BorderSizePixel = 0
	action.FontFace = Ui.FONT_MONO_BOLD
	action.TextSize = 12
	action.Parent = row
	Ui.corner(action, 19)

	-- equip indicator for owned permanents
	local equipped = Instance.new("TextLabel")
	equipped.Size = UDim2.new(0, 10, 0, 20)
	equipped.AutomaticSize = Enum.AutomaticSize.X
	equipped.Position = UDim2.new(1, -140, 0.5, -10)
	equipped.BackgroundTransparency = 1
	equipped.Text = "✓ EQUIPPED"
	equipped.TextColor3 = tok.fg
	equipped.FontFace = Ui.FONT_MONO_BOLD
	equipped.TextSize = 10
	equipped.Visible = false
	equipped.Parent = row

	action.MouseButton1Click:Connect(function()
		self:onAction(itemDef, action, equipped)
	end)

	local preview = nil
	local spec = Preview.Preview.previewSpecFor(itemDef.id)
	if spec then
		preview = Preview.PreviewPlayer.new(previewHolder, spec, App.state.theme, 140, 80)
	end

	return { row = row, def = itemDef, action = action, equipped = equipped, preview = preview }
end

function Shop:isEquipped(def)
	local s = App.state.settings or {}
	if def.category == "skin" then return s.skin == def.id end
	if def.category == "trail" then return s.trail == def.id end
	if def.category == "taunt" then return s.taunt == def.id end
	return false
end

function Shop:onAction(def, action, equipped)
	if def.category == "gear" then
		-- consumable: always buy more
		self:buy(def)
		return
	end
	local owned = App.ownedQty(def.id) > 0 or def.price == 0
	if not owned then
		self:buy(def)
	else
		self:equip(def)
	end
end

function Shop:buy(def)
	task.spawn(function()
		local ok, res = pcall(function() return Remotes.BuyItem:InvokeServer({ itemId = def.id }) end)
		if ok and res and res.ok then
			if res.profile then App.state.profile = res.profile end
			if res.owned then App.state.owned = res.owned end
			if res.newAchievements then
				for _, key in ipairs(res.newAchievements) do
					local d = nil
					for _, a in ipairs(Catalog.ACHIEVEMENTS) do if a.key == key then d = a end end
					if d then App.notify("ACHIEVEMENT · " .. d.name, d.desc, "success") end
				end
			end
			Audio.sfx.buy()
			App.notify("PURCHASED", def.name .. " IS YOURS", "silent")
			self:refresh()
		else
			Audio.sfx.denied()
			App.notify("NOT ENOUGH COINS", (res and res.error) or "THE GRIND CONTINUES", "error")
		end
	end)
end

function Shop:equip(def)
	local field = if def.category == "skin" then "skin" elseif def.category == "trail" then "trail" else "taunt"
	local patch = { [field] = def.id }
	task.spawn(function()
		local ok, res = pcall(function() return Remotes.PatchSettings:InvokeServer(patch) end)
		if ok and res and res.settings then
			App.state.settings = res.settings
			Audio.sfx.select()
			App.notify("EQUIPPED", def.name, "silent")
			self:refresh()
		end
	end)
end

function Shop:refresh()
	self.coinsText.Text = string.format("● %d", App.coins())
	for _, item in ipairs(self.items) do
		local def = item.def
		local owned = App.ownedQty(def.id) > 0 or def.price == 0
		local equipped = self:isEquipped(def)
		item.equipped.Visible = equipped and def.category ~= "gear"
		local tok = Ui.tokens(App.state.theme)
		local isGear = def.category == "gear"
		if not isGear and equipped then
			item.action.Text = "EQUIPPED"
			item.action.BackgroundColor3 = tok.pan2
			item.action.TextColor3 = tok.mut
		elseif not isGear and owned then
			item.action.Text = "EQUIP"
			item.action.BackgroundColor3 = tok.fg
			item.action.TextColor3 = tok.bg
		else
			item.action.Text = string.format("BUY ● %d", def.price)
			item.action.BackgroundColor3 = tok.fg
			item.action.TextColor3 = tok.bg
		end
	end
end

function Shop:onEnter()
	if not self.rendered then
		self.rendered = true
		self:renderItems()
	else
		self:refresh()
	end
end

function Shop:onExit()
	for _, item in ipairs(self.items) do
		if item.preview then item.preview:destroy(); item.preview = nil end
	end
	self.rendered = false
end

return Shop
