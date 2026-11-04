import React from 'react';
import { approveOperation, run } from '../../../../bridge';
import { environmentLabel } from '../../../../selection.ts';
import type { PendingOperation } from '../../../../../shared/types.ts';
import { OperationValue } from './components/operation-value/OperationValue';

type Props = { pending: PendingOperation; disabled: boolean };
export const ApprovalCard: React.FC<Props> = ({ pending, disabled }) => {
  const operation = pending.operation;
  const name = operation.toolName ?? '';
  const title =
    operation.kind === 'upload'
      ? 'Confirm image upload'
      : /unpublish/i.test(name)
        ? 'Confirm unpublishing'
        : /publish/i.test(name)
          ? 'Confirm publication'
          : /delete|remove|destroy/i.test(name)
            ? 'Confirm removal'
            : 'Confirm content change';
  const fields =
    operation.kind === 'upload'
      ? Object.fromEntries(
          Object.entries({
            Image: operation.file?.split('/').at(-1),
            Name: operation.name,
            'Alternative text': operation.alt,
            Caption: operation.caption,
            Folder: operation.folderId,
          }).filter(([, value]) => value !== undefined),
        )
      : operation.arguments;

  return (
    <section className="card approval">
      <div className="eyebrow">Action required</div>
      <h2>{title}</h2>
      <p>
        {pending.profile.name} · {environmentLabel(pending.profile.environment)}
      </p>
      <p className="url">{pending.profile.cmsUrl}</p>
      <details>
        <summary>Review this operation</summary>
        {operation.kind !== 'upload' && <p className="hint">{name.replaceAll('_', ' ')}</p>}
        <OperationValue value={fields} />
      </details>
      <p className="hint">This confirms only this operation on this connection.</p>
      <div className="actions">
        <button
          className="primary"
          disabled={disabled}
          onClick={() => void run(() => approveOperation(pending.operationId))}
        >
          Confirm and continue
        </button>
      </div>
    </section>
  );
};
