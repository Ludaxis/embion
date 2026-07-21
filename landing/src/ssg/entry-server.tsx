import { renderToString } from 'react-dom/server';
import { App as NoirApp } from '../v1/App';
import { App as ExplorerApp } from '../v3/App';
import {
  DevelopersPage, ResearchPage, LeRobotPage, DatasetsPage, DevkitPage, StoryPage,
} from '../site/pages';

/** Build-time prerender: page id → static HTML for the #root div. */
export function render(page: string): string {
  switch (page) {
    case 'home': return renderToString(<NoirApp />);
    case 'v3': return renderToString(<ExplorerApp />);
    case 'developers': return renderToString(<DevelopersPage />);
    case 'research': return renderToString(<ResearchPage />);
    case 'lerobot': return renderToString(<LeRobotPage />);
    case 'datasets': return renderToString(<DatasetsPage />);
    case 'devkit': return renderToString(<DevkitPage />);
    case 'story': return renderToString(<StoryPage />);
    default: throw new Error(`unknown page: ${page}`);
  }
}
