/// <reference types="vitest-axe/extend-expect" />
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { EarningsCalculator } from "./earnings-calculator";
import { LocaleProvider } from "@/components/shell/locale-provider";

describe("the earnings calculator on Earn with Mshwar", () => {
  it("recalculates from the guide's own numbers and says it is an estimate", async () => {
    const { container } = render(
      <LocaleProvider>
        <EarningsCalculator />
      </LocaleProvider>,
    );
    expect(screen.getByText("Illustrative estimate")).toBeInTheDocument();
    expect(screen.getByTestId("calc-week")).toHaveTextContent("$420");

    fireEvent.change(screen.getByLabelText("Tours per week"), { target: { value: "4" } });
    expect(screen.getByTestId("calc-week")).toHaveTextContent("$720");
    expect(screen.getByTestId("calc-month")).toHaveTextContent("$3,120");
    expect(screen.getByText(/Mshwar fee today: 0%/)).toBeInTheDocument();
    expect(screen.getByText(/12% fee, you would keep \$2,746 a month/)).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });
});
