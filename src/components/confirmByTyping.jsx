import { Input, Modal } from 'antd'

// Delete confirmation that stays disabled until `phrase` is typed exactly.
export default function confirmByTyping({ title, content, phrase, onOk }) {
  let typed = ''
  const modal = Modal.confirm({
    centered: true,
    title,
    okText: 'Delete',
    okButtonProps: { danger: true, disabled: true },
    content: (
      <>
        <p>{content}</p>
        <p>Type <strong>{phrase}</strong> to confirm.</p>
        <Input autoFocus onChange={(e) => {
          typed = e.target.value
          modal.update({ okButtonProps: { danger: true, disabled: typed.trim() !== phrase } })
        }} />
      </>
    ),
    onOk,
  })
}
