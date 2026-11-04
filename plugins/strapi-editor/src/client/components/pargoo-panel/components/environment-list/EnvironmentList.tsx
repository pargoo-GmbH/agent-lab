import React from 'react';
import { environmentLabel, isActive } from '../../../../selection.ts';
import type { EditorState, Profile } from '../../../../../shared/types.ts';
import { Icon } from '../../../common/icon/Icon';

type Props = {
  profiles: Profile[];
  selected: Profile | null;
  checks: EditorState['checks'];
  disabled: boolean;
  onUse: (profile: Profile) => void;
  onEdit: (profile: Profile) => void;
};
export const EnvironmentList: React.FC<Props> = ({
  profiles,
  selected,
  checks,
  disabled,
  onUse,
  onEdit,
}) => (
  <ul className="environment-list" aria-label="Strapi environments">
    {profiles.map((profile) => {
      const active = isActive(profile, selected);
      const check = checks[profile.id];

      return (
        <li
          key={profile.id}
          className={`environment-row${active ? ' is-active' : ''}`}
          aria-current={active ? 'true' : undefined}
          aria-label={profile.name}
        >
          <div className="environment-info">
            <div className="environment-title">
              <h3>{profile.name}</h3>
              <span className={`type-badge ${profile.environment}`}>
                {environmentLabel(profile.environment)}
              </span>
            </div>
            <p className="url">{profile.cmsUrl}</p>
            {check?.status === 'needs_attention' && (
              <p className="connection-issue">Connection needs attention</p>
            )}
          </div>
          <div className="environment-actions">
            {active ? (
              <span className="active-badge" role="status">
                <Icon name="check" />
                In this chat
              </span>
            ) : (
              <button
                disabled={disabled}
                aria-label={`Use environment ${profile.name}`}
                onClick={() => onUse(profile)}
              >
                Use
              </button>
            )}
            <button
              className="settings-button quiet"
              disabled={disabled}
              aria-label={`Settings for ${profile.name}`}
              title="Environment settings"
              onClick={() => onEdit(profile)}
            >
              <Icon name="settings" />
              Settings
            </button>
          </div>
        </li>
      );
    })}
  </ul>
);
