import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { AppDataSource } from '../db/index.js';
import { Project } from '../entities/Project.js';
import { getCurrentUserId } from './index.js';
import { formatCurrency } from '../utils/format.js';
import { queueForSync } from '../services/sync.js';
import { t } from '../i18n/index.js';

// Freemium limits
const FREE_PROJECT_LIMIT = 3;

export function getProjectToolDefinitions(): Tool[] {
  return [
    {
      name: 'list_projects',
      annotations: { readOnlyHint: true },
      description: t('projects.listDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'completed', 'archived', 'all'],
            description: t('projects.statusFilterDesc'),
          },
        },
      },
    },
    {
      name: 'rename_project',
      description: t('projects.renameDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: t('projects.projectNameDesc'),
          },
          new_name: {
            type: 'string',
            description: t('projects.newNameDesc'),
          },
        },
        required: ['project', 'new_name'],
      },
    },
    {
      name: 'create_project',
      description: t('projects.createDesc', { limit: String(FREE_PROJECT_LIMIT) }),
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: t('projects.createNameDesc'),
          },
          description: {
            type: 'string',
            description: t('projects.createDescriptionDesc'),
          },
          budget: {
            type: 'number',
            description: t('projects.createBudgetDesc'),
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'delete_project',
      annotations: { destructiveHint: true },
      description: t('projects.deleteDesc'),
      inputSchema: {
        type: 'object',
        properties: {
          project: {
            type: 'string',
            description: t('projects.deleteProjectDesc'),
          },
        },
        required: ['project'],
      },
    },
  ];
}

async function findProjectByName(name: string, userId: string): Promise<Project | null> {
  if (!name) return null;

  const projectRepo = AppDataSource.getRepository(Project);

  const project = await projectRepo
    .createQueryBuilder('project')
    .where('project.userId = :userId', { userId })
    .andWhere('LOWER(project.name) LIKE LOWER(:name)', { name: `%${name}%` })
    .getOne();

  return project;
}

export async function listProjects(args: Record<string, unknown>): Promise<unknown> {
  const userId = getCurrentUserId();
  const projectRepo = AppDataSource.getRepository(Project);
  const status = (args.status as string) || 'active';

  const queryBuilder = projectRepo
    .createQueryBuilder('project')
    .where('project.userId = :userId', { userId });

  if (status !== 'all') {
    queryBuilder.andWhere('project.status = :status', { status });
  }

  queryBuilder.orderBy('project.name', 'ASC');

  const projects = await queryBuilder.getMany();

  // Get transaction stats for each project
  const transactionRepo = AppDataSource.getRepository('Transaction');
  const projectStats = await Promise.all(
    projects.map(async (p) => {
      const stats = await transactionRepo
        .createQueryBuilder('t')
        .select('SUM(CASE WHEN t.type = :expense THEN t.amount ELSE 0 END)', 'spent')
        .addSelect('SUM(CASE WHEN t.type = :income THEN t.amount ELSE 0 END)', 'earned')
        .addSelect('COUNT(*)', 'count')
        .where('t.projectId = :projectId', { projectId: p.id })
        .setParameter('expense', 'expense')
        .setParameter('income', 'income')
        .getRawOne();

      return {
        id: p.id,
        name: p.name,
        description: p.description || null,
        status: p.status,
        budget: p.budget ? Number(p.budget) : null,
        spent: Number(stats?.spent || 0),
        earned: Number(stats?.earned || 0),
        transactions: Number(stats?.count || 0),
        formatted_budget: p.budget ? formatCurrency(Number(p.budget)) : null,
        formatted_spent: formatCurrency(Number(stats?.spent || 0)),
      };
    })
  );

  return {
    projects: projectStats,
    total: projects.length,
    limit: {
      used: projects.length,
      max: FREE_PROJECT_LIMIT,
      remaining: Math.max(0, FREE_PROJECT_LIMIT - projects.length),
      tier: 'free',
    },
  };
}

export async function renameProject(args: Record<string, unknown>): Promise<unknown> {
  const userId = getCurrentUserId();
  const projectRepo = AppDataSource.getRepository(Project);

  const projectName = args.project as string;
  const newName = args.new_name as string;

  if (!projectName || !newName) {
    throw new Error(t('projects.nameRequired'));
  }

  const project = await findProjectByName(projectName, userId);

  if (!project) {
    throw new Error(t('projects.projectNotFound', { name: projectName }));
  }

  const oldName = project.name;
  project.name = newName;

  await projectRepo.save(project);

  // Queue for cloud sync
  queueForSync('project', project.id, 'update').catch(() => {});

  return {
    success: true,
    message: t('projects.renamed', { old: oldName, new: newName }),
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
    },
  };
}

export async function createProject(args: Record<string, unknown>): Promise<unknown> {
  const userId = getCurrentUserId();
  const projectRepo = AppDataSource.getRepository(Project);

  const name = args.name as string;
  const description = args.description as string | undefined;
  const budget = args.budget as number | undefined;

  if (!name) {
    throw new Error(t('projects.projectNameRequired'));
  }

  // Check project limit (Free tier: 3 projects)
  const projectCount = await projectRepo.count({ where: { userId } });
  if (projectCount >= FREE_PROJECT_LIMIT) {
    throw new Error(t('projects.limitReached', { limit: String(FREE_PROJECT_LIMIT) }));
  }

  // Check if project with same name exists
  const existing = await findProjectByName(name, userId);
  if (existing) {
    throw new Error(t('projects.alreadyExists', { name }));
  }

  const project = projectRepo.create({
    userId,
    name,
    description,
    budget,
    status: 'active',
  });

  await projectRepo.save(project);

  // Queue for cloud sync
  queueForSync('project', project.id, 'create').catch(() => {});

  return {
    success: true,
    message: t('projects.created', { name }),
    project: {
      id: project.id,
      name: project.name,
      description: project.description || null,
      budget: project.budget ? Number(project.budget) : null,
      status: project.status,
    },
  };
}

export async function deleteProject(args: Record<string, unknown>): Promise<unknown> {
  const userId = getCurrentUserId();
  const projectRepo = AppDataSource.getRepository(Project);
  const transactionRepo = AppDataSource.getRepository('Transaction');

  const projectName = args.project as string;

  if (!projectName) {
    throw new Error(t('projects.projectNameRequired'));
  }

  const project = await findProjectByName(projectName, userId);

  if (!project) {
    throw new Error(t('projects.projectNotFound', { name: projectName }));
  }

  // Remove project assignment from transactions
  // Use null for TypeORM query builder (undefined doesn't work)
  await transactionRepo
    .createQueryBuilder()
    .update()
    .set({ projectId: null as unknown as string | undefined })
    .where('projectId = :projectId', { projectId: project.id })
    .execute();

  const projectId = project.id;
  const deletedName = project.name;

  // Queue for cloud sync BEFORE removing locally
  await queueForSync('project', projectId, 'delete');

  await projectRepo.remove(project);

  return {
    success: true,
    message: t('projects.deleted', { name: deletedName }),
  };
}
