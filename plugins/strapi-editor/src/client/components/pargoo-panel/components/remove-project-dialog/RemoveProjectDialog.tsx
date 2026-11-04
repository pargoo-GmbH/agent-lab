import React, { useEffect, useRef } from 'react';
import { removeProject, run } from '../../../../bridge';
import type { Project } from '../../../../../shared/types.ts';

type Props = {
  project: Project;
  environmentCount: number;
  disabled: boolean;
  onClose: () => void;
  onRemoved: () => void;
};
export const RemoveProjectDialog: React.FC<Props> = ({
  project,
  environmentCount,
  disabled,
  onClose,
  onRemoved,
}) => {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="remove-project-title"
      aria-describedby="remove-project-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id="remove-project-title">Remove {project.name}?</h2>
      <p id="remove-project-description">
        {environmentCount > 0
          ? `This project has ${environmentCount} saved environment${environmentCount === 1 ? '' : 's'}. Remove them using each environment’s Settings first.`
          : 'This removes the empty project from this Mac. Content in Strapi is kept.'}
      </p>
      <div className="actions">
        <button
          className="danger"
          disabled={disabled || environmentCount > 0}
          onClick={() =>
            void run(async () => {
              onClose();
              await removeProject(project);
              onRemoved();
            })
          }
        >
          Remove project
        </button>
        <button disabled={disabled} onClick={onClose}>
          Cancel
        </button>
      </div>
    </dialog>
  );
};
