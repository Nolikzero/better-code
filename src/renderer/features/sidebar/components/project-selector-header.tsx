import { useAtom } from "jotai";
import { ChevronDown, FolderGit2, GitBranch, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../components/ui/command";
import { CheckIcon, FolderPlusIcon } from "../../../components/ui/icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";
import { trpc } from "../../../lib/trpc";
import { cn } from "../../../lib/utils";
import { selectedProjectAtom } from "../../agents/atoms";

function ProjectIcon({
  gitOwner,
  gitProvider,
  className = "h-4 w-4",
}: {
  gitOwner?: string | null;
  gitProvider?: string | null;
  className?: string;
}) {
  if (gitOwner && gitProvider === "github") {
    return (
      <img
        src={`https://github.com/${gitOwner}.png?size=64`}
        alt={gitOwner}
        className={`${className} rounded-xs shrink-0`}
      />
    );
  }
  return (
    <FolderGit2 className={`${className} text-muted-foreground shrink-0`} />
  );
}

interface ProjectSelectorHeaderProps {
  onNewWorkspace?: () => void;
}

export function ProjectSelectorHeader({
  onNewWorkspace,
}: ProjectSelectorHeaderProps) {
  const [selectedProject, setSelectedProject] = useAtom(selectedProjectAtom);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: projects, isLoading: isLoadingProjects } =
    trpc.projects.list.useQuery();

  // Fetch current branch for the selected project
  const { data: branchData } = trpc.changes.getBranches.useQuery(
    { worktreePath: selectedProject?.path ?? "" },
    {
      enabled: !!selectedProject?.path,
      refetchInterval: 10000, // Refresh every 10s to catch branch changes
    },
  );

  const currentBranch = branchData?.currentBranch;

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.path.toLowerCase().includes(query),
    );
  }, [projects, searchQuery]);

  const utils = trpc.useUtils();

  const openFolder = trpc.projects.openFolder.useMutation({
    onSuccess: (project) => {
      if (project) {
        utils.projects.list.setData(undefined, (oldData) => {
          if (!oldData) return [project];
          const exists = oldData.some((p) => p.id === project.id);
          if (exists) {
            return oldData.map((p) =>
              p.id === project.id ? { ...p, updatedAt: project.updatedAt } : p,
            );
          }
          return [project, ...oldData];
        });

        setSelectedProject({
          id: project.id,
          name: project.name,
          path: project.path,
          gitRemoteUrl: project.gitRemoteUrl,
          gitProvider: project.gitProvider as
            | "github"
            | "gitlab"
            | "bitbucket"
            | null,
          gitOwner: project.gitOwner,
          gitRepo: project.gitRepo,
        });
      }
    },
  });

  const handleOpenFolder = async () => {
    setOpen(false);
    await openFolder.mutateAsync();
  };

  const handleSelectProject = (projectId: string) => {
    const project = projects?.find((p) => p.id === projectId);
    if (project) {
      setSelectedProject({
        id: project.id,
        name: project.name,
        path: project.path,
        gitRemoteUrl: project.gitRemoteUrl,
        gitProvider: project.gitProvider as
          | "github"
          | "gitlab"
          | "bitbucket"
          | null,
        gitOwner: project.gitOwner,
        gitRepo: project.gitRepo,
      });
      setOpen(false);
    }
  };

  const validSelection = useMemo(() => {
    if (!selectedProject) return null;
    if (isLoadingProjects) return selectedProject;
    if (!projects) return null;
    const exists = projects.some((p) => p.id === selectedProject.id);
    return exists ? selectedProject : null;
  }, [selectedProject, projects, isLoadingProjects]);

  // No projects - show "Add repository" prompt
  if (
    !validSelection &&
    (!projects || projects.length === 0) &&
    !isLoadingProjects
  ) {
    return (
      <div className="px-2 py-2">
        <button
          onClick={handleOpenFolder}
          disabled={openFolder.isPending}
          className="flex items-center gap-2 w-full px-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
        >
          <FolderPlusIcon className="h-4 w-4" />
          <span>{openFolder.isPending ? "Adding..." : "Add repository"}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="px-2 py-2 flex items-center gap-1">
      <Popover
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) setSearchQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 text-sm rounded-md transition-colors",
              "hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 outline-offset-2",
            )}
            type="button"
          >
            <ProjectIcon
              gitOwner={validSelection?.gitOwner}
              gitProvider={validSelection?.gitProvider}
            />
            <div className="flex flex-col flex-1 min-w-0 text-left">
              <span className="truncate font-medium">
                {validSelection?.name || "Select repository"}
              </span>
              {currentBranch && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                  <GitBranch className="h-3 w-3 shrink-0" />
                  {currentBranch}
                </span>
              )}
            </div>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start" sideOffset={4}>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search repositories..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList className="max-h-[300px] overflow-y-auto">
              {isLoadingProjects ? (
                <div className="px-2.5 py-4 text-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : filteredProjects.length > 0 ? (
                <CommandGroup>
                  {filteredProjects.map((project) => {
                    const isSelected = validSelection?.id === project.id;
                    return (
                      <CommandItem
                        key={project.id}
                        value={`${project.name} ${project.path}`}
                        onSelect={() => handleSelectProject(project.id)}
                        className="gap-2"
                      >
                        <ProjectIcon
                          gitOwner={project.gitOwner}
                          gitProvider={project.gitProvider}
                        />
                        <span className="truncate flex-1">{project.name}</span>
                        {isSelected && (
                          <CheckIcon className="h-4 w-4 shrink-0" />
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ) : (
                <CommandEmpty>No repositories found.</CommandEmpty>
              )}
            </CommandList>
            <div className="border-t border-border/50 py-1">
              <button
                onClick={handleOpenFolder}
                disabled={openFolder.isPending}
                className="flex items-center gap-1.5 min-h-[32px] py-[5px] px-1.5 mx-1 w-[calc(100%-8px)] rounded-md text-sm cursor-default select-none outline-hidden dark:hover:bg-neutral-800 hover:text-foreground transition-colors"
              >
                <FolderPlusIcon className="h-4 w-4 text-muted-foreground" />
                <span>
                  {openFolder.isPending ? "Adding..." : "Add repository"}
                </span>
              </button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      {/* New workspace button */}
      {onNewWorkspace && validSelection && (
        <button
          onClick={onNewWorkspace}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          title="New workspace"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
