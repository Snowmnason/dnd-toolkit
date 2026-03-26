import { APP_VERSION } from "@/lib/utils/version";
import { Caption } from "./ui/AppText";

interface VersionDisplayProps {
  style?: any;
}

export default function VersionDisplay({ style }: VersionDisplayProps) {
  return (
    <Caption style={[{ marginTop: 4, opacity: 0.7 }, style]}>
      Version {APP_VERSION}
    </Caption>
  );
}
