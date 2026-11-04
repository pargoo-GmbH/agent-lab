import type { Profile, Environment } from '../shared/types.ts';
export const isActive = (
  profile: Pick<Profile, 'id' | 'revision'> | null | undefined,
  active: Pick<Profile, 'id' | 'revision'> | null | undefined,
) => Boolean(profile && active && profile.id === active.id && profile.revision === active.revision);
export const environmentLabel = (environment: Environment) =>
  environment === 'production' ? 'Production' : 'Development';
