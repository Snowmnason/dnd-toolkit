import { Caption } from "@/components/ui";
import { useScale } from "@/theme";
import React from "react";
import { Control, Controller, FieldPath, FieldValues } from "react-hook-form";
import { View } from "react-native";
import AuthInput from "../AuthInput";

/**
 * RHF wrapper for AuthInput
 */
export type FormAuthInputProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  inputRef?: React.RefObject<any>;
  onChangeText?: (text: string) => void; // optional external sync
} & Omit<React.ComponentProps<typeof AuthInput>, "value" | "onChangeText">;

export function FormAuthInput<T extends FieldValues>({
  control,
  name,
  inputRef,
  ...props
}: FormAuthInputProps<T>) {
  const S = useScale();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View
          style={{
            // Align spacing to caption height instead of generic margin
            marginBottom: fieldState.error ? 0 : S.font.caption + S.space.xs * 1.7,
          }}
        >
          <AuthInput
            ref={inputRef}
            {...props}
            value={(field.value as string) ?? ""}
            onChangeText={(val) => {
              field.onChange(val) // Update RHF state first
              if (props.onChangeText) props.onChangeText(val) // Then call external handler
            }}
            style={{
              ...(props.style as any),
              borderColor: fieldState.error
                ? "#dc3545"
                : (props.style as any)?.borderColor,
              borderWidth: fieldState.error
                ? 3
                : (props.style as any)?.borderWidth,
            }}
          />
          {/* Show error with minimal gap and no persistent spacing */}
          {fieldState.error && (
            <Caption
              fontSize="$caption"
              italic={false}
              textType="primary"
              style={{
                color: "#dc3545",
                marginTop: S.space.xs * 0.5,
                marginBottom: S.space.xs,
                marginLeft: S.space.sm,
                overflow: 'hidden',
              }}
            >
              {fieldState.error?.message}
            </Caption>
          )}
        </View>
      )}
    />
  );
}
