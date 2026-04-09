import { AppDataSource } from '../db/index.js';
import { Project } from '../entities/Project.js';

export async function findProjectByName(name: string, userId: string): Promise<Project | null> {
  if (!name) return null;

  const projectRepo = AppDataSource.getRepository(Project);

  const project = await projectRepo
    .createQueryBuilder('project')
    .where('project.userId = :userId', { userId })
    .andWhere('LOWER(project.name) LIKE LOWER(:name)', { name: `%${name.replace(/[%_]/g, '\\$&')}%` })
    .getOne();

  return project;
}
