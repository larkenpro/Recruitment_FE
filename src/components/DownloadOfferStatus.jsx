import { useState } from 'react'
import { Button, message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { getErrorMessage } from '../utils/errorUtils'
import { saveFile } from '../utils/download'

// Downloads one of the team's sheets — the offer-status one unless `label` says otherwise: `request()`
// asks the backend for it (an .xlsx blob).
export default function DownloadOfferStatus({ request, fileName, disabled, label = 'Download Offer Status', size = 'small', type }) {
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      saveFile((await request()).data, fileName)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button size={size} type={type} icon={<DownloadOutlined />} disabled={disabled} loading={busy} onClick={download}>
      {label}
    </Button>
  )
}
