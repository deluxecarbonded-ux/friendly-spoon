--!strict
-- EXOTIC icons — the web build uses lucide-react SVG strokes. Roblox cannot
-- load those SVGs without uploaded PNG decals, so each icon maps to the closest
-- monochrome glyph that renders natively with the Inconsolata/Segoe UI Symbol
-- font, preserving the game's flat monochrome look. Render via Icons.label().

local Icons = {}

-- glyph per logical icon (lucide name → unicode)
Icons.G = {
	LOGO = "◆",
	COIN = "●", COINS = "◉", SKULL = "☠", TROPHY = "♛", LOCK = "🔒",
	FLAG = "⚑", GHOST = "▢", PLAY = "▶", LAYERS = "▤", SHOPPING_BAG = "▣",
	SETTINGS = "⚙", BAR_CHART = "▥", BADGE_INFO = "ⓘ", CHEVRON_LEFT = "‹",
	CHEVRON_RIGHT = "›", CROSSHAIR = "✛", VOLUME = "🔊", VOLUME_X = "🔇",
	PAUSE = "❚❚", PLAY2 = "▶", ROTATE_CCW = "↻", ARROW_LEFT = "←", MAIL = "✉",
	USER_PLUS = "👤", LOG_IN = "⇥", CHECK = "✓", MEDAL = "🥇", TIMER = "⏱",
	REPEAT = "⇄", BOMB = "✸", SHIELD = "⬟", CROWN = "♚", TRASH = "🗑",
	MOON = "☾", SUN = "☀", FLASK = "⚗", REVEAL = "⊕", ANCHOR = "⚓",
	SKIP = "⏩", HEART = "♥", STAR = "★", BOLT = "⚡",
}

-- Build a TextLabel showing an icon glyph.
function Icons.label(props)
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.Size = props.size or UDim2.new(0, 20, 0, 20)
	l.Text = Icons.G[props.icon] or props.icon or ""
	l.TextColor3 = props.color
	l.FontFace = props.font or Font.new("rbxasset://fonts/families/Inconsolata.json", Enum.FontWeight.Bold)
	l.TextSize = props.textSize or 16
	l.TextXAlignment = Enum.TextXAlignment.Center
	l.TextYAlignment = Enum.TextYAlignment.Center
	l.Parent = props.parent
	if props.layoutOrder then l.LayoutOrder = props.layoutOrder end
	return l
end

return Icons
