import type { ReactNode } from 'react';

export type FormElementProps = {
  /** Submits the form. Web wires it to the DOM submit event; native does not. */
  onSubmit: () => void;
  className?: string | undefined;
  children?: ReactNode;
};
