import React, { useState, useSyncExternalStore } from 'react';
import {
  getSnapshot,
  notify,
  openPreview,
  retryCredentialCleanup,
  run,
  selectProfile,
  subscribe,
} from '../../bridge';
import type { Profile, Project } from '../../../shared/types.ts';
import { Brand } from '../common/brand/Brand';
import { Icon } from '../common/icon/Icon';
import { ApprovalCard } from './components/approval-card/ApprovalCard';
import { EnvironmentForm } from './components/environment-form/EnvironmentForm';
import { EnvironmentList } from './components/environment-list/EnvironmentList';
import { ProjectForm } from './components/project-form/ProjectForm';
import { RemoveProjectDialog } from './components/remove-project-dialog/RemoveProjectDialog';

type View =
  | { kind: 'project' }
  | { kind: 'new-project' }
  | { kind: 'environment'; project: Project; profile: Profile | null };
export const PargooPanel: React.FC = () => {
  const { state, connected, working, displayMode, message, error } = useSyncExternalStore(
    subscribe,
    getSnapshot,
  );
  const [projectId, setProjectId] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: 'project' });
  const [removingProject, setRemovingProject] = useState<Project | null>(null);
  const disabled = !connected || working;
  const project =
    state?.projects.find((item) => item.id === projectId) ??
    state?.projects.find((item) => item.name === state.selected?.project) ??
    state?.projects[0];
  const profiles = state?.profiles.filter((profile) => profile.project === project?.name) ?? [];
  const close = () => {
    notify();
    setView({ kind: 'project' });
  };
  const addEnvironment = () => {
    if (project) {
      notify();
      setView({ kind: 'environment', project, profile: null });
    }
  };
  const addProject = () => {
    notify();
    setView({ kind: 'new-project' });
  };
  const projectSaved = (saved: Project) => {
    setProjectId(saved.id);
    close();
  };
  const contextVisible =
    state?.selected && (view.kind !== 'project' || state.selected.project !== project?.name);

  if (displayMode !== 'fullscreen') {
    return (
      <section className="launcher" aria-label="pargoo Strapi (Apple Silicon) preview">
        <Brand compact />
        <button disabled={disabled} onClick={() => void run(openPreview)}>
          Open pargoo
        </button>
        {error && message && <p role="alert">{message}</p>}
      </section>
    );
  }

  return (
    <main className="panel">
      <header className="panel-header">
        <Brand />
      </header>
      {message && (
        <div className={`notice${error ? ' error' : ''}`} role={error ? 'alert' : 'status'}>
          {message}
        </div>
      )}
      {state?.credentialCleanupPending && (
        <div className="notice" role="status">
          <p>
            Some old credentials could not be removed from this Mac. Retry to finish removing them.
          </p>
          <button disabled={disabled} onClick={() => void run(retryCredentialCleanup)}>
            Retry cleanup
          </button>
        </div>
      )}
      {state && view.kind !== 'project' && (
        <button className="back-button quiet" disabled={disabled} onClick={close}>
          ← Back to {project?.name ?? 'projects'}
        </button>
      )}
      {!state ? (
        <div className="empty">
          <h1>Opening your workspace…</h1>
          <p>Loading saved projects and environments.</p>
        </div>
      ) : view.kind === 'new-project' ? (
        <ProjectForm disabled={disabled} onSaved={projectSaved} onClose={close} />
      ) : view.kind === 'environment' ? (
        <EnvironmentForm
          key={view.profile?.id ?? view.project.id}
          project={view.project}
          profile={view.profile}
          check={view.profile ? state.checks[view.profile.id] : undefined}
          disabled={disabled}
          onSaved={close}
          onClose={close}
        />
      ) : !project ? (
        <section className="empty card">
          <h1>Create your first project</h1>
          <p>Add a project name, then connect its Strapi environments.</p>
          <button className="primary" disabled={disabled} onClick={addProject}>
            New project
          </button>
        </section>
      ) : (
        <>
          <section className="project-heading" aria-label="Project">
            <div className="row project-label">
              <label htmlFor={state.projects.length > 1 ? 'project-select' : undefined}>
                Project
              </label>
              <button className="quiet" disabled={disabled} onClick={addProject}>
                + New project
              </button>
            </div>
            <div className="project-controls">
              {state.projects.length === 1 ? (
                <h1>{project.name}</h1>
              ) : (
                <select
                  id="project-select"
                  value={project.id}
                  disabled={disabled}
                  onChange={(event) => {
                    notify();
                    setProjectId(event.target.value);
                  }}
                >
                  {state.projects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                className="remove-project-button quiet"
                disabled={disabled}
                aria-label={`Remove project ${project.name}`}
                title="Remove project"
                onClick={() => {
                  notify();
                  setRemovingProject(project);
                }}
              >
                <Icon name="trash" />
              </button>
            </div>
          </section>
          <section aria-labelledby="environment-title">
            <div className="row environment-heading">
              <h2 id="environment-title">Strapi environments</h2>
              {profiles.length > 0 && (
                <button
                  className="quiet"
                  disabled={disabled}
                  aria-label="Add environment"
                  onClick={addEnvironment}
                >
                  + Add
                </button>
              )}
            </div>
            {!state.selected && profiles.length > 0 && (
              <p className="selection-hint">Choose an environment for this chat.</p>
            )}
            {profiles.length ? (
              <EnvironmentList
                profiles={profiles}
                selected={state.selected}
                checks={state.checks}
                disabled={disabled}
                onUse={(profile) => void run(() => selectProfile(profile))}
                onEdit={(profile) => {
                  notify();
                  setView({ kind: 'environment', project, profile });
                }}
              />
            ) : (
              <div className="empty-environments">
                <h2>No environments yet</h2>
                <p>Add the first Strapi connection for this project.</p>
                <button className="primary" disabled={disabled} onClick={addEnvironment}>
                  + Add environment
                </button>
              </div>
            )}
          </section>
        </>
      )}
      {removingProject && (
        <RemoveProjectDialog
          project={removingProject}
          environmentCount={
            state?.profiles.filter((profile) => profile.project === removingProject.name).length ??
            0
          }
          disabled={disabled}
          onClose={() => setRemovingProject(null)}
          onRemoved={() => {
            setRemovingProject(null);
            setProjectId(null);
          }}
        />
      )}
      <section className="pending-list" aria-live="polite">
        {state?.pendingOperations.map((pending) => (
          <ApprovalCard key={pending.operationId} pending={pending} disabled={disabled} />
        ))}
      </section>
      {state && (
        <footer>
          {contextVisible && (
            <p className="active-context">
              <span className="footer-dot active" />
              This chat uses {state.selected!.project} · {state.selected!.name}
            </p>
          )}
          {!state.selected && view.kind !== 'project' && <p>No active environment in this chat.</p>}
          <p>Write articles and add images with your agent in chat.</p>
        </footer>
      )}
    </main>
  );
};
