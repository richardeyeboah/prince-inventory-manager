import { useState } from 'react'
import { useShop } from '../store'
import { makeTestJob, type TestReceiptKind } from '../lib/test-job'
import { ReceiptModal } from './ReceiptModal'

export function TestJob({ onClose }: { onClose: () => void }) {
  const { isOwner } = useShop()
  const [kind, setKind] = useState<TestReceiptKind>('sale')
  const [createdAt] = useState(() => new Date().toISOString())
  if (!isOwner) return null
  return <ReceiptModal key={kind} sale={makeTestJob(kind, createdAt)} testOnly onClose={onClose} previewControls={<div className="test-job-controls">
    <label>Test receipt<select value={kind} onChange={(e) => setKind(e.target.value as TestReceiptKind)}>
      <option value="sale">Paid sale</option><option value="credit">Part-paid sale</option><option value="void">Void receipt</option>
    </select></label>
    <p>Uses the current receipt design. Nothing is saved and stock and money stay unchanged.</p>
  </div>} />
}
