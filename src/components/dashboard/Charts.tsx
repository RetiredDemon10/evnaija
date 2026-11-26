import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatNaira } from '@/lib/utils'

const tooltipStyle = {
  borderRadius: 14,
  border: '1px solid rgba(7,27,34,0.08)',
  boxShadow: '0 12px 32px -12px rgba(7,27,34,0.2)',
  fontSize: 12,
  fontFamily: 'Onest',
}

export function RevenueAreaChart({
  data,
  height = 280,
}: {
  data: { label: string; revenue: number; bookings?: number }[]
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C6F36A" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#C6F36A" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 6" stroke="rgba(7,27,34,0.07)" vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} dy={8} />
        <YAxis
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => formatNaira(value, { compact: true })}
          width={62}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number) => [formatNaira(value), 'Revenue']}
          labelStyle={{ fontWeight: 700, color: '#071B22' }}
        />
        <Area type="monotone" dataKey="revenue" stroke="#8BC521" strokeWidth={2.5} fill="url(#revGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function BookingsBarChart({
  data,
  height = 240,
  color = '#071B22',
}: {
  data: { label: string; value: number }[]
  height?: number
  color?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barSize={18}>
        <CartesianGrid strokeDasharray="3 6" stroke="rgba(7,27,34,0.07)" vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} dy={8} />
        <YAxis axisLine={false} tickLine={false} width={40} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(198,243,106,0.12)' }} />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

const DONUT_COLORS = ['#071B22', '#8BC521', '#C6F36A', '#547A7E', '#A0B3B4']

export function DonutChart({
  data,
  height = 220,
  centerLabel,
  centerValue,
}: {
  data: { label: string; value: number }[]
  height?: number
  centerLabel?: string
  centerValue?: string
}) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius="66%" outerRadius="88%" paddingAngle={3} stroke="none">
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      {centerValue && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="font-mono text-xl font-medium text-midnight-900">{centerValue}</p>
            {centerLabel && <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">{centerLabel}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
