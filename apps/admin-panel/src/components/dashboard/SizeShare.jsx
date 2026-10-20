import HBars from '../charts/HBars'
import Card from '../ui/Card'
import CardHead from '../ui/CardHead'

export default function SizeShare({ rows }) {
  return (
    <Card className="min-w-0">
      <CardHead title="Ventas por talla" sub="Para planear la producción" />
      <div className="px-5 pb-5">
        <HBars rows={rows} label="Distribución de ventas por talla" valueFmt={(v) => `${v} %`} />
      </div>
    </Card>
  )
}
