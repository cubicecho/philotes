import { Text } from 'react-native';
import { LABEL_CLASS, type LabelProps } from '@/components/ui/label-base';
import { cn } from '@/lib/utils';

function Label({ className, id, children }: LabelProps) {
  return (
    <Text id={id} className={cn(LABEL_CLASS, className)}>
      {children}
    </Text>
  );
}

export { Label };
