import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { portManager } from "../../terminal/port-manager";
import type { DetectedPort } from "../../terminal/types";
import { publicProcedure, router } from "../index";

export const portsRouter = router({
  /**
   * Get all currently detected ports
   */
  getAll: publicProcedure.query(() => {
    return portManager.getAllPorts();
  }),

  /**
   * Get ports for a specific workspace
   */
  getByWorkspace: publicProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(({ input }) => {
      return portManager.getPortsByWorkspace(input.workspaceId);
    }),

  /**
   * Subscribe to port change events (add/remove)
   */
  onPortChange: publicProcedure
    .input(z.object({ workspaceId: z.string().optional() }).optional())
    .subscription(({ input }) => {
      return observable<{ type: "add" | "remove"; port: DetectedPort }>(
        (emit) => {
          const onAdd = (port: DetectedPort) => {
            if (!input?.workspaceId || port.workspaceId === input.workspaceId) {
              emit.next({ type: "add", port });
            }
          };
          const onRemove = (port: DetectedPort) => {
            if (!input?.workspaceId || port.workspaceId === input.workspaceId) {
              emit.next({ type: "remove", port });
            }
          };

          portManager.on("port:add", onAdd);
          portManager.on("port:remove", onRemove);

          return () => {
            portManager.off("port:add", onAdd);
            portManager.off("port:remove", onRemove);
          };
        },
      );
    }),

  /**
   * Force an immediate port scan
   */
  forceScan: publicProcedure.mutation(async () => {
    await portManager.forceScan();
    return portManager.getAllPorts();
  }),
});
