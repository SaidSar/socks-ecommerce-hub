import HBars from '../charts/HBars'
import Card from '../ui/Card'
import CardHead from '../ui/CardHead'

export default function TopPieces({ rows }) {
  return (
    <Card className="min-w-0">
      <CardHead title="Más vendidas" sub="Pares, últimos 30 días" />
      <div className="px-5 pb-5">
        <HBars rows={rows} label="Piezas más vendidas" valueFmt={(v) => `${v} ${v === 1 ? 'par' : 'pares'}`} />
      </div>
    </Card>
  )
}
