export const appName = 'régie';
export const docsRoute = '/docs';

export const gitConfig = {
  user: 'edwinfranck',
  repo: 'regie',
  branch: 'main',
};

export const repoUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

/** Lien « Modifier sur GitHub » d'une page de documentation. */
export const editUrl = (path: string) => `${repoUrl}/blob/${gitConfig.branch}/apps/site/content/docs/${path}`;
