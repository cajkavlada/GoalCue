import { createContext, useContext, useState } from "react";
import { nanoid } from "nanoid";

import { MODAL_AFTER_CLOSE_LIFE_TIME } from "../constants";
import { Drawer } from "./drawer";
import { useDrawerContext as useVaulDrawerContext } from "./vaul";

type DrawerItem = {
  id: string;
  content: React.ReactNode;
};

const DrawerContext = createContext<{
  activeDrawerCount: number;
  drawerContentStack: DrawerItem[];
  openDrawer: (content: React.ReactNode) => void;
  closeDrawer: () => void;
  closeAllDrawers: () => void;
}>({
  activeDrawerCount: 0,
  drawerContentStack: [],
  openDrawer: () => {},
  closeDrawer: () => {},
  closeAllDrawers: () => {},
});

const DrawerIdContext = createContext<string | null>(null);

export function useDrawerId() {
  return useContext(DrawerIdContext);
}

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [activeDrawerCount, setActiveDrawerCount] = useState(0);
  const [drawerContentStack, setDrawerContentStack] = useState<DrawerItem[]>(
    []
  );

  function openDrawer(content: React.ReactNode) {
    const id = nanoid();

    setActiveDrawerCount((prev) => prev + 1);
    setDrawerContentStack((prev) => [
      ...prev,
      {
        id,
        content: (
          <DrawerIdContext
            key={id}
            value={id}
          >
            {content}
          </DrawerIdContext>
        ),
      },
    ]);
  }

  function closeDrawer() {
    setActiveDrawerCount((prev) => Math.max(prev - 1, 0));
    setTimeout(() => {
      setDrawerContentStack((prev) => prev.slice(0, -1));
    }, MODAL_AFTER_CLOSE_LIFE_TIME);
  }

  function closeAllDrawers() {
    setActiveDrawerCount(0);
    setTimeout(() => {
      setDrawerContentStack([]);
    }, MODAL_AFTER_CLOSE_LIFE_TIME);
  }

  const providerValue = {
    activeDrawerCount,
    drawerContentStack,
    openDrawer,
    closeDrawer,
    closeAllDrawers,
  };

  return (
    <DrawerContext value={providerValue}>
      {children}
      <Drawer
        direction="right"
        open={activeDrawerCount > 0}
        onOpenChange={closeDrawer}
        autoFocus={activeDrawerCount > 0}
      >
        {drawerContentStack.length > 0 && drawerContentStack[0]?.content}
      </Drawer>
    </DrawerContext>
  );
}

export function useDrawer() {
  const {
    openDrawer: origOpenDrawer,
    closeDrawer,
    closeAllDrawers,
  } = useContext(DrawerContext);
  const { onNestedOpenChange } = useVaulDrawerContext();

  function openDrawer(content: React.ReactNode) {
    origOpenDrawer(content);
    onNestedOpenChange(true);
  }

  return { openDrawer, closeDrawer, closeAllDrawers };
}

export function useDrawerInternal() {
  const { activeDrawerCount, drawerContentStack, closeDrawer } =
    useContext(DrawerContext);
  return { activeDrawerCount, drawerContentStack, closeDrawer };
}
