import type { RouteObject } from 'react-router-dom';

export const knowledgeChildRoute: RouteObject = {
  path: 'knowledge',
  lazy: async () => {
    const { KnowledgeLayout } = await import('./pages/knowledge-layout');
    return { Component: KnowledgeLayout };
  },
  children: [
    {
      index: true,
      lazy: async () => {
        const { KnowledgeArticlesPage } = await import('./pages/articles-page');
        return { Component: KnowledgeArticlesPage };
      },
    },
    {
      path: 'articles/new',
      lazy: async () => {
        const { KnowledgeArticleEditorPage } = await import('./pages/article-editor-page');
        return { Component: KnowledgeArticleEditorPage };
      },
    },
    {
      path: 'articles/:articleId',
      lazy: async () => {
        const { KnowledgeArticleEditorPage } = await import('./pages/article-editor-page');
        return { Component: KnowledgeArticleEditorPage };
      },
    },
    {
      path: 'sources',
      lazy: async () => {
        const { KnowledgeSourcesPage } = await import('./pages/sources-page');
        return { Component: KnowledgeSourcesPage };
      },
    },
    {
      path: 'playground',
      lazy: async () => {
        const { KnowledgePlaygroundPage } = await import('./pages/playground-page');
        return { Component: KnowledgePlaygroundPage };
      },
    },
  ],
};
