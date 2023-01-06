import { expect, test, describe } from "vitest";
import { mount } from "@vue/test-utils";
import App from "../src/Main.vue";
import { getDimensions, resetFields } from "../src/utils";

describe("App", () => {
  let wrapper = mount(App);

  test("App.vue exists", () => {
    expect(App).toBeTruthy();
  });

  test("'Development Mode' displays during local development", () => {
    //console.log(wrapper.find("b"));
    expect(wrapper.find("b").text()).toEqual("Frontend Development Mode");
  });

  test("Check getDimensions()", async () => {
    let check = (await getDimensions()) as string[];
    expect(check).toStrictEqual(["x", "y", "z", "color", "size"]);
  });

  test("check resetFields()", () => {
    let check = resetFields({ data: ["x"] });
    expect(check).toContain(null);
  });
});
