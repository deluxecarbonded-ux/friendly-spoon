--!strict
-- EXOTIC utils — port of src/lib/utils.ts formatters.

local Utils = {}

function Utils.fmtTime(ms: number?): string
	if ms == nil or ms <= 0 then return "--:--.-" end
	local s = math.floor(ms / 1000)
	local m = math.floor(s / 60)
	return string.format("%d:%02d.%d", m, s % 60, math.floor((ms % 1000) / 100))
end

function Utils.fmtClock(ms: number): string
	local s = math.floor(ms / 1000)
	return string.format("%02d:%02d", math.floor(s / 60), s % 60)
end

function Utils.pad2(n: number): string
	return string.format("%02d", n)
end

return Utils
