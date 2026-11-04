import React, { useRef } from 'react';
import { createProject, run } from '../../../../bridge';
import type { Project } from '../../../../../shared/types.ts';

type Props = { disabled: boolean; onSaved: (project: Project) => void; onClose: () => void };
export const ProjectForm: React.FC<Props> = ({ disabled, onSaved, onClose }) => {
  const form = useRef<HTMLFormElement>(null);
  const submit = () => {
    if (disabled || !form.current?.reportValidity()) {
      return;
    }

    const name = String(new FormData(form.current).get('name') ?? '');
    void run(async () => onSaved(await createProject(name)));
  };

  return (
    <form
      ref={form}
      className="project-form"
      autoComplete="off"
      onSubmit={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') {
          event.preventDefault();
          submit();
        }
      }}
    >
      <div className="page-heading">
        <h1>New project</h1>
        <p>You can add Strapi environments after creating the project.</p>
      </div>
      <fieldset disabled={disabled}>
        <label htmlFor="project-name">Project name</label>
        <input
          id="project-name"
          name="name"
          required
          maxLength={100}
          placeholder="e.g. Example Project"
        />
        <div className="actions">
          <button className="primary" type="button" onClick={submit}>
            Create project
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
};
