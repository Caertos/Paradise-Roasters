import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthContextValue } from "../../auth/authContext";
import { makeAuth, withAuth } from "../../auth/testAuth";
import { ApiError } from "../../lib/api";
import Login from "./Login";

function renderLogin(login: AuthContextValue["login"]) {
  return render(
    withAuth(
      makeAuth({ login }),
      <MemoryRouter initialEntries={["/login"]}>
        <Login />
      </MemoryRouter>,
    ),
  );
}

// The Vitest setup does not enable globals, so RTL cannot auto-clean.
afterEach(cleanup);

describe("Login form", () => {
  it("shows the 422 field errors next to their fields", async () => {
    const login = vi.fn<AuthContextValue["login"]>().mockRejectedValue(
      new ApiError(422, "The email field must be a valid email address.", {
        email: ["The email field must be a valid email address."],
        password: ["The password field is required."],
      }),
    );
    renderLogin(login);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email"), "ada@example");
    await user.type(screen.getByLabelText("Password"), "x");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(login).toHaveBeenCalledWith("ada@example", "x");
    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Password");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription(
      "The email field must be a valid email address.",
    );
    expect(password).toHaveAccessibleDescription(
      "The password field is required.",
    );
    expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
  });

  it("shows the top-level message for invalid credentials", async () => {
    const login = vi
      .fn<AuthContextValue["login"]>()
      .mockRejectedValue(new ApiError(401, "Invalid credentials."));
    renderLogin(login);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid credentials.",
    );
  });
});
