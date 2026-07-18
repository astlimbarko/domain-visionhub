import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ProximamentePlaceholder({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{descripcion}</p>
      </CardContent>
    </Card>
  );
}
