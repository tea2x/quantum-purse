import React from "react";
import { ConfigProvider } from "antd";

export const AntdProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#009EA7",
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
};
