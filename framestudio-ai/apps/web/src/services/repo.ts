import { ProjectRepository } from '@framestudio/project-storage';

/** Repositório local único da aplicação (IndexedDB + OPFS). */
export const repo = new ProjectRepository();
